"""tests for the fastapi service, driven entirely offline."""
import pytest
from fastapi.testclient import TestClient

from etl_pipeline.api.app import app, get_fetcher


@pytest.fixture
def client(fake_http):
    """a test client whose /run uses the offline fetcher."""
    app.dependency_overrides[get_fetcher] = lambda: fake_http
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health_reports_ok(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert "version" in body


def test_sources_lists_all_four(client):
    body = client.get("/sources").json()
    assert body["sources"] == ["clinicaltrials", "nih_reporter", "openalex", "sec_edgar"]


def test_run_returns_records(client):
    response = client.post("/run", json={"entity": "NVIDIA", "ticker": "NVDA"})
    assert response.status_code == 200
    body = response.json()
    assert body["entity"] == "NVIDIA"
    assert body["count"] == len(body["records"])
    kinds = {r["record_type"] for r in body["records"]}
    assert kinds == {"filing", "paper", "trial", "grant"}


def test_run_reports_source_status(client):
    body = client.post("/run", json={"entity": "NVIDIA", "ticker": "NVDA"}).json()
    statuses = {s["source"]: s for s in body["sources"]}
    assert statuses["openalex"]["ok"] is True
    assert set(statuses) == {"clinicaltrials", "nih_reporter", "openalex", "sec_edgar"}


def test_run_subset_of_sources(client):
    body = client.post("/run", json={"entity": "NVIDIA", "sources": ["openalex"]}).json()
    assert {r["source"] for r in body["records"]} == {"openalex"}


def test_run_validates_max_results(client):
    response = client.post("/run", json={"entity": "X", "max_results": 999})
    assert response.status_code == 422  # exceeds the ge/le bounds


def test_demo_returns_prebaked_records(client):
    body = client.get("/demo", params={"entity": "NVIDIA"}).json()
    assert body["count"] == 8
    assert {r["record_type"] for r in body["records"]} == {"filing", "paper", "trial", "grant"}


def test_demo_unknown_entity_falls_back(client):
    body = client.get("/demo", params={"entity": "Unknown Co"}).json()
    assert body["count"] > 0
