"""tests for the nih reporter connector."""
from etl_pipeline.config import Config
from etl_pipeline.connectors import nih_reporter
from etl_pipeline.models import Query
from tests.conftest import load_fixture


def test_build_body_is_a_text_search():
    body = nih_reporter.build_body("Acme", 8)
    assert body["criteria"]["advanced_text_search"]["search_text"] == "Acme"
    assert body["limit"] == 8


def test_project_url_builds_link():
    assert nih_reporter.project_url("999") == "https://reporter.nih.gov/project-details/999"


def test_parse_projects_skips_rows_without_id():
    payload = load_fixture("nih_projects.json")
    records = nih_reporter.parse_projects(payload, "Acme")
    assert len(records) == 2  # third project has no application id
    assert records[0].native_id == "5R01AA000001-02"
    assert records[0].extra["organization"] == "UNIVERSITY OF EXAMPLE"
    assert records[0].date == "2023-01-01"


def test_fetch_posts_body(fake_http):
    result = nih_reporter.fetch(Query(entity="Acme"), fake_http, Config())
    assert result.ok is True
    assert len(result.records) == 2
    assert fake_http.calls[-1]["method"] == "POST"
    assert fake_http.calls[-1]["body"] is not None


def test_fetch_empty_entity(fake_http):
    assert nih_reporter.fetch(Query(entity=""), fake_http, Config()).records == []


def test_fetch_reports_failure():
    def boom(method, url, params=None, body=None, headers=None):
        raise RuntimeError("down")

    assert nih_reporter.fetch(Query(entity="Acme"), boom, Config()).ok is False
