"""tests for the json project store and its endpoints, offline."""
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from etl_pipeline.api.app import app, get_db_path
from etl_pipeline.store.projects import (
    delete_project,
    get_project,
    list_projects,
    save_project,
)


@pytest.fixture
def db_path(tmp_path):
    """a throwaway store file per test."""
    return tmp_path / "projects.json"


def test_save_and_get_round_trip(db_path):
    entry = save_project("chip scan", "sector", "semiconductors",
                         {"sector": "semiconductors"}, path=db_path)
    assert entry["name"] == "chip scan"
    full = get_project(entry["id"], path=db_path)
    assert full["payload"] == {"sector": "semiconductors"}
    assert full["saved_at"]


def test_blank_name_falls_back_to_subject(db_path):
    entry = save_project("  ", "company", "NVIDIA", {}, path=db_path)
    assert entry["name"] == "NVIDIA"


def test_unknown_mode_is_rejected(db_path):
    with pytest.raises(ValueError):
        save_project("x", "spreadsheet", "y", {}, path=db_path)


def test_list_is_newest_first_without_payload(db_path):
    save_project("a", "company", "Apple", {"k": 1}, path=db_path)
    save_project("b", "sector", "banking", {"k": 2}, path=db_path)
    projects = list_projects(path=db_path)
    assert len(projects) == 2
    assert all("payload" not in p for p in projects)


def test_delete_reports_whether_anything_was_deleted(db_path):
    entry = save_project("a", "company", "Apple", {}, path=db_path)
    assert delete_project(entry["id"], path=db_path) is True
    assert delete_project(entry["id"], path=db_path) is False
    assert get_project(entry["id"], path=db_path) is None


def test_concurrent_saves_never_corrupt_or_drop_a_write(db_path):
    # 20 threads writing the same json file at once is exactly the race a
    # file lock exists to prevent: without one, two writers reading-then-
    # overwriting the same stale snapshot silently drop each other's save.
    def save(index):
        return save_project(f"p{index}", "company", f"co-{index}", {"i": index},
                            path=db_path)

    with ThreadPoolExecutor(max_workers=20) as pool:
        list(pool.map(save, range(20)))

    projects = list_projects(path=db_path)
    assert len(projects) == 20
    assert {p["name"] for p in projects} == {f"p{i}" for i in range(20)}


@pytest.fixture
def client(db_path):
    """a test client whose project routes use the throwaway database."""
    app.dependency_overrides[get_db_path] = lambda: db_path
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_projects_endpoints_round_trip(client):
    created = client.post("/projects", json={
        "name": "chip scan", "mode": "sector", "subject": "semiconductors",
        "payload": {"sector": "semiconductors"}})
    assert created.status_code == 201
    project_id = created.json()["id"]

    listing = client.get("/projects").json()
    assert [p["id"] for p in listing] == [project_id]

    full = client.get(f"/projects/{project_id}").json()
    assert full["payload"] == {"sector": "semiconductors"}

    assert client.delete(f"/projects/{project_id}").status_code == 204
    assert client.get(f"/projects/{project_id}").status_code == 404
    assert client.delete(f"/projects/{project_id}").status_code == 404


def test_projects_rejects_bad_mode(client):
    response = client.post("/projects", json={
        "name": "x", "mode": "spreadsheet", "subject": "y", "payload": {}})
    assert response.status_code == 422
