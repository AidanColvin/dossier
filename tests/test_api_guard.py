"""tests for the api edge defenses: rate limits, body caps, headers."""
import pytest
from fastapi.testclient import TestClient

from etl_pipeline.api.app import app, get_fetcher
from etl_pipeline.api.guard import (
    MAX_BODY_BYTES,
    RateLimiter,
    body_too_large,
    route_family,
)


def test_route_family_prefix_matching():
    assert route_family("/sector") == "/sector"
    assert route_family("/sector/stream") == "/sector"
    assert route_family("/projects/abc123") == "/projects"
    assert route_family("/directory.csv") == "/directory"
    assert route_family("/health") == "*"


def test_limiter_allows_within_budget_and_blocks_over():
    limiter = RateLimiter()
    assert all(limiter.allow("1.2.3.4", "/sector") for _ in range(3))
    assert limiter.allow("1.2.3.4", "/sector") is False
    # a different client and a different family are unaffected.
    assert limiter.allow("5.6.7.8", "/sector") is True
    assert limiter.allow("1.2.3.4", "/health") is True


def test_body_too_large():
    assert body_too_large("") is False
    assert body_too_large(str(MAX_BODY_BYTES)) is False
    assert body_too_large(str(MAX_BODY_BYTES + 1)) is True
    assert body_too_large("not a number") is True


def test_security_headers_are_stamped():
    client = TestClient(app)
    response = client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Cache-Control"] == "no-store"
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]


@pytest.fixture
def offline_client(fake_http):
    """a test client that can never reach the network."""
    app.dependency_overrides[get_fetcher] = lambda: fake_http
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_oversized_body_is_rejected(offline_client):
    response = offline_client.post(
        "/run", content=b"x" * (MAX_BODY_BYTES + 1),
        headers={"Content-Type": "application/json",
                 "Content-Length": str(MAX_BODY_BYTES + 1)})
    assert response.status_code == 413


def test_over_budget_client_gets_429(offline_client):
    app.state.limiter.reset()
    for _ in range(3):
        offline_client.post("/sector", json={"sector": "semiconductors",
                                             "max_companies": 1})
    blocked = offline_client.post("/sector", json={"sector": "semiconductors",
                                                   "max_companies": 1})
    assert blocked.status_code == 429
