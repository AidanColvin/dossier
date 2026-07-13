"""tests for the openalex connector."""
from etl_pipeline.config import Config
from etl_pipeline.connectors import openalex
from etl_pipeline.models import Query
from tests.conftest import load_fixture


def test_build_params_uses_affiliation_filter():
    params = openalex.build_params("NVIDIA", 5)
    assert params["filter"] == "raw_affiliation_strings.search:NVIDIA"
    assert params["per-page"] == 5


def test_work_url_prefers_open_access():
    work = {"open_access": {"oa_url": "https://oa.test/x"}, "id": "https://openalex.org/W1"}
    assert openalex.work_url(work) == "https://oa.test/x"


def test_work_url_falls_back_to_id():
    work = {"open_access": {"oa_url": ""}, "id": "https://openalex.org/W1"}
    assert openalex.work_url(work) == "https://openalex.org/W1"


def test_work_sources_adds_doi():
    urls = openalex.work_sources({"doi": "https://doi.org/10.1/x"}, "https://openalex.org/W1")
    assert urls == ["https://openalex.org/W1", "https://doi.org/10.1/x"]


def test_parse_works_skips_untitled():
    payload = load_fixture("openalex_works.json")
    records = openalex.parse_works(payload, "NVIDIA")
    assert len(records) == 2  # the third work has no title
    assert records[0].record_type == "paper"
    assert records[0].extra["journal"] == "Nature Machine Intelligence"


def test_fetch_happy_path(fake_http):
    result = openalex.fetch(Query(entity="NVIDIA"), fake_http, Config())
    assert result.ok is True
    assert len(result.records) == 2


def test_fetch_empty_entity_is_empty(fake_http):
    result = openalex.fetch(Query(entity="  "), fake_http, Config())
    assert result.records == []


def test_fetch_reports_failure():
    def boom(method, url, params=None, body=None, headers=None):
        raise RuntimeError("down")

    result = openalex.fetch(Query(entity="NVIDIA"), boom, Config())
    assert result.ok is False
