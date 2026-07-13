"""tests for the clinicaltrials.gov connector."""
from etl_pipeline.config import Config
from etl_pipeline.connectors import clinicaltrials
from etl_pipeline.models import Query
from tests.conftest import load_fixture


def test_build_params_uses_sponsor_query():
    params = clinicaltrials.build_params("Acme", 7)
    assert params["query.spons"] == "Acme"
    assert params["pageSize"] == 7


def test_study_url_builds_link():
    assert clinicaltrials.study_url("NCT01") == "https://clinicaltrials.gov/study/NCT01"


def test_parse_studies_skips_rows_without_id():
    payload = load_fixture("clinicaltrials_studies.json")
    records = clinicaltrials.parse_studies(payload, "Acme")
    assert len(records) == 2  # third study has no nct id
    assert records[0].native_id == "NCT05000001"
    assert records[0].extra["status"] == "RECRUITING"
    assert records[0].date == "2023-06-01"


def test_fetch_happy_path(fake_http):
    result = clinicaltrials.fetch(Query(entity="Acme"), fake_http, Config())
    assert result.ok is True
    assert len(result.records) == 2


def test_fetch_empty_entity(fake_http):
    assert clinicaltrials.fetch(Query(entity=""), fake_http, Config()).records == []


def test_fetch_reports_failure():
    def boom(method, url, params=None, body=None, headers=None):
        raise RuntimeError("down")

    assert clinicaltrials.fetch(Query(entity="Acme"), boom, Config()).ok is False
