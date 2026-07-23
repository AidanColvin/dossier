"""tests for the sector endpoints, driven entirely offline."""
import json

import pytest
from fastapi.testclient import TestClient

from etl_pipeline.api.app import app, get_fetcher


@pytest.fixture
def client(fake_http):
    """a test client whose sector routes use the offline fetcher."""
    app.dependency_overrides[get_fetcher] = lambda: fake_http
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_sector_returns_full_report(client):
    response = client.post("/sector", json={"sector": "semiconductors",
                                            "max_companies": 2})
    assert response.status_code == 200
    body = response.json()
    assert body["sector"] == "semiconductors"
    assert body["method"] == "curated"
    assert body["overview"]["companies_total"] == 2
    assert len(body["companies"]) == 2
    assert body["references"]


def test_sector_rejects_empty_sector(client):
    assert client.post("/sector", json={"sector": ""}).status_code == 422


def test_sector_rejects_oversized_company_count(client):
    response = client.post("/sector", json={"sector": "banking",
                                            "max_companies": 50})
    assert response.status_code == 422


def parse_events(text: str) -> list[tuple[str, dict]]:
    """
    given a raw sse body
    return its (kind, payload) pairs in order
    """
    events = []
    for block in text.strip().split("\n\n"):
        kind, payload = "", {}
        for line in block.splitlines():
            if line.startswith("event: "):
                kind = line[len("event: "):]
            elif line.startswith("data: "):
                payload = json.loads(line[len("data: "):])
        events.append((kind, payload))
    return events


def test_sector_stream_event_sequence(client):
    response = client.get("/sector/stream",
                          params={"sector": "semiconductors",
                                  "max_companies": 2})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    events = parse_events(response.text)
    kinds = [k for k, _ in events if k != "heartbeat"]
    assert kinds[0] == "resolved"
    assert kinds.count("progress") == 2
    assert kinds[-3:] == ["building", "verifying", "done"]
    done = events[-1][1]
    assert done["sector"] == "semiconductors"
    assert len(done["companies"]) == 2


def test_sector_stream_requires_sector(client):
    assert client.get("/sector/stream").status_code == 422
