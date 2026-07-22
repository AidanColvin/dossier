"""Every connector returns a verification object on every record."""
from etl_pipeline.config import Config
from etl_pipeline.connectors import clinicaltrials, nih_reporter, openalex, sec_edgar
from etl_pipeline.models import Query
from tests.conftest import load_fixture

REQUIRED = {"method", "matched_on", "strict"}


def _fetcher():
    """Returns a fetcher routing each url to its fixture, like conftest."""
    routes = {
        "company_tickers": load_fixture("sec_company_tickers.json"),
        "submissions": load_fixture("sec_submissions.json"),
        "openalex": load_fixture("openalex_works.json"),
        "clinicaltrials": load_fixture("clinicaltrials_studies.json"),
        "reporter.nih": load_fixture("nih_projects.json"),
    }

    def http(method, url, params=None, body=None, headers=None):
        for needle, payload in routes.items():
            if needle in url:
                return payload
        return {}

    return http


def test_every_connector_record_carries_verification():
    http = _fetcher()
    query = Query(entity="NVIDIA", ticker="NVDA")
    for module in (sec_edgar, openalex, clinicaltrials, nih_reporter):
        result = module.fetch(query, http, Config())
        assert result.ok, module.NAME
        for record in result.records:
            assert REQUIRED <= set(record.verification), module.NAME


def test_each_source_reports_its_own_method():
    http = _fetcher()
    query = Query(entity="NVIDIA", ticker="NVDA")
    methods = {
        sec_edgar: "cik_match",
        openalex: "author_affiliation",
        clinicaltrials: "sponsor_match",
        nih_reporter: "awardee_match",
    }
    for module, method in methods.items():
        result = module.fetch(query, http, Config())
        for record in result.records:
            assert record.verification["method"] == method, module.NAME
