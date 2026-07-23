"""tests for the partnerships endpoint, driven entirely offline."""
import pytest
from fastapi.testclient import TestClient

from etl_pipeline.api.app import app, get_fetcher
from tests.conftest import load_fixture
from tests.test_partnerships import partnership_http  # noqa: F401 - fixture reuse


@pytest.fixture
def client(partnership_http):  # noqa: F811 - fixture injection
    """a test client whose /partnerships uses the offline fetcher."""
    app.dependency_overrides[get_fetcher] = lambda: partnership_http
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_partnerships_returns_full_payload(client):
    response = client.get("/partnerships",
                          params={"company": "NVDA", "institution": "unc"})
    assert response.status_code == 200
    body = response.json()
    assert body["company"] == "NVIDIA"
    assert body["company_resolved"] is True
    assert body["institution"] == "University of North Carolina at Chapel Hill"
    assert body["trials"]
    assert body["faculty_leads"]
    assert body["filing_mentions"]
    assert body["signals"]
    assert body["talking_points"]
    assert 1 <= len(body["talking_points"]) <= 8


def test_partnerships_requires_both_params(client):
    assert client.get("/partnerships",
                      params={"company": "NVDA"}).status_code == 422
    assert client.get("/partnerships",
                      params={"institution": "unc"}).status_code == 422
