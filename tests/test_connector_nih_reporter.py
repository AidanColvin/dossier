"""tests for the nih reporter connector."""
from etl_pipeline.config import Config
from etl_pipeline.connectors import nih_reporter
from etl_pipeline.models import Query
from tests.conftest import load_fixture


def test_build_body_filters_by_organization_name():
    body = nih_reporter.build_body("Acme", 8)
    assert body["criteria"]["org_names"] == ["Acme"]
    # Over-fetched, since org_names itself is a loose match.
    assert body["limit"] > 8


def test_project_url_builds_link():
    assert nih_reporter.project_url("999") == "https://reporter.nih.gov/project-details/999"


def test_is_awardee_match_accepts_the_company_and_its_subsidiaries():
    assert nih_reporter.is_awardee_match("ACME CORPORATION", "Acme") is True
    assert nih_reporter.is_awardee_match("ACME RESEARCH INSTITUTE", "Acme") is True


def test_is_awardee_match_rejects_a_same_prefix_lookalike():
    """'Acmetech Solutions' is not Acme, even though it starts with the letters."""
    assert nih_reporter.is_awardee_match("ACMETECH SOLUTIONS", "Acme") is False


def test_is_awardee_match_rejects_the_unrelated_grants_a_text_search_would_catch():
    """The bug this replaces: a keyword search for 'Apple' returned grants from
    the University of Wisconsin and Charles Drew University because 'Apple'
    appeared somewhere in the title or abstract. Neither is Apple."""
    assert nih_reporter.is_awardee_match("UNIVERSITY OF WISCONSIN MILWAUKEE", "Apple") is False
    assert nih_reporter.is_awardee_match("CHARLES R. DREW UNIVERSITY OF MED & SCI", "Apple") is False


def test_is_awardee_match_rejects_an_investigator_whose_surname_matches():
    """'Apple, Rima D.' is a person, stored the way NIH keys some individual
    fellowship awards. A surname coincidence is not the company."""
    assert nih_reporter.is_awardee_match("APPLE, RIMA D.", "Apple") is False


def test_is_awardee_match_still_accepts_institutions_with_a_comma():
    """A real institution's comma-separated suffix must not be caught by the
    person-name check."""
    assert nih_reporter.is_awardee_match(
        "UNIVERSITY OF CALIFORNIA, SAN FRANCISCO", "University Of California"
    ) is True


def test_parse_projects_drops_lookalikes_and_malformed_rows():
    payload = load_fixture("nih_projects.json")
    records = nih_reporter.parse_projects(payload, "NVIDIA", limit=10)
    # Two genuine matches; the lookalike and the malformed row are both dropped.
    assert len(records) == 2
    assert records[0].extra["organization"] == "NVIDIA CORPORATION"
    assert records[1].extra["organization"] == "NVIDIA RESEARCH INSTITUTE"
    assert all(r.verification["strict"] for r in records)


def test_parse_projects_respects_the_limit():
    payload = load_fixture("nih_projects.json")
    records = nih_reporter.parse_projects(payload, "NVIDIA", limit=1)
    assert len(records) == 1


def test_fetch_posts_body(fake_http):
    result = nih_reporter.fetch(Query(entity="NVIDIA"), fake_http, Config())
    assert result.ok is True
    assert len(result.records) == 2
    assert fake_http.calls[-1]["method"] == "POST"
    assert fake_http.calls[-1]["body"] is not None


def test_fetch_empty_entity(fake_http):
    assert nih_reporter.fetch(Query(entity=""), fake_http, Config()).records == []


def test_fetch_reports_failure():
    def boom(method, url, params=None, body=None, headers=None):
        raise RuntimeError("down")

    assert nih_reporter.fetch(Query(entity="NVIDIA"), boom, Config()).ok is False
