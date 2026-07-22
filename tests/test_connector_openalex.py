"""tests for the openalex connector."""
from etl_pipeline.config import Config
from etl_pipeline.connectors import openalex
from etl_pipeline.models import Query
from tests.conftest import load_fixture


def test_build_params_uses_ror_authorship_lookup_when_resolved():
    params = openalex.build_params("Apple", 5, "059hsda18")
    assert params["filter"] == "authorships.institutions.ror:059hsda18"


def test_build_params_falls_back_to_display_name_search():
    params = openalex.build_params("Apple", 5, "")
    assert params["filter"] == "authorships.institutions.display_name.search:Apple"


def test_work_url_prefers_open_access():
    work = {"open_access": {"oa_url": "https://oa.test/x"}, "id": "https://openalex.org/W1"}
    assert openalex.work_url(work) == "https://oa.test/x"


def test_work_url_falls_back_to_id():
    work = {"open_access": {"oa_url": ""}, "id": "https://openalex.org/W1"}
    assert openalex.work_url(work) == "https://openalex.org/W1"


def test_work_sources_adds_doi():
    urls = openalex.work_sources({"doi": "https://doi.org/10.1/x"}, "https://openalex.org/W1")
    assert urls == ["https://openalex.org/W1", "https://doi.org/10.1/x"]


def test_is_scholarly_keeps_articles_and_drops_software():
    assert openalex.is_scholarly({"type": "article"}) is True
    assert openalex.is_scholarly({"type": "preprint"}) is True
    assert openalex.is_scholarly({"type": "software"}) is False
    assert openalex.is_scholarly({"type": "dataset"}) is False
    # A missing type is kept, so a data gap never silently drops a record.
    assert openalex.is_scholarly({}) is True


def test_parse_works_skips_untitled():
    payload = load_fixture("openalex_works.json")
    records = openalex.parse_works(payload, "NVIDIA", "ror:x", True, 10)
    assert len(records) == 2  # the third work has no title
    assert records[0].record_type == "paper"
    assert records[0].verification["method"] == "author_affiliation"


def test_parse_works_drops_software_dumps():
    payload = {
        "results": [
            {"id": "https://openalex.org/W1", "title": "Real paper", "type": "article"},
            {"id": "https://openalex.org/W2", "title": "kovdan01/llvm-project-ptrenc: ptrenc", "type": "software"},
        ]
    }
    records = openalex.parse_works(payload, "Apple", "ror:x", True, 10)
    titles = [r.title for r in records]
    assert "Real paper" in titles
    assert "kovdan01/llvm-project-ptrenc: ptrenc" not in titles


def test_parse_works_dedupes_by_id():
    payload = {
        "results": [
            {"id": "https://openalex.org/W1", "title": "Same", "type": "article"},
            {"id": "https://openalex.org/W1", "title": "Same", "type": "article"},
        ]
    }
    records = openalex.parse_works(payload, "Apple", "ror:x", True, 10)
    assert len(records) == 1


def test_fetch_returns_verification_field(fake_http):
    result = openalex.fetch(Query(entity="NVIDIA"), fake_http, Config())
    assert result.ok is True
    assert all("method" in r.verification for r in result.records)
