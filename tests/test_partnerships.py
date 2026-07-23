"""tests for partnership resolution, signals, and talking points, offline."""
import pytest

from etl_pipeline.partnerships.institutions import (
    canonical_institution,
    resolve_institution,
)
from etl_pipeline.partnerships.resolver import resolve_partnership
from etl_pipeline.partnerships.signals import (
    CoauthoredPaper,
    FacultyLead,
    PartnerTrial,
    PartnershipEvidence,
    detect_signals,
)
from etl_pipeline.partnerships.talking_points import build_talking_points
from tests.conftest import load_fixture


@pytest.fixture
def partnership_http():
    """
    a fetcher routing each partnership lookup to its fixture: institution
    searches answer by type of name searched, works and trials and grants
    and filings each get their own payload.
    """
    institutions = load_fixture("openalex_institutions.json")
    routes = {
        "company_tickers": load_fixture("sec_company_tickers.json"),
        "submissions": load_fixture("sec_submissions.json"),
        "openalex.org/works": load_fixture("openalex_works.json"),
        "clinicaltrials": load_fixture("ct_partnership_studies.json"),
        "reporter.nih": load_fixture("nih_partnership_projects.json"),
        "efts.sec.gov": load_fixture("efts_filings.json"),
    }
    calls: list[dict] = []

    def fetch(method, url, params=None, body=None, headers=None):
        calls.append({"method": method, "url": url, "params": params,
                      "body": body})
        if "openalex.org/institutions" in url:
            wanted = (params or {}).get("search", "").lower()
            key = "education" if "university" in wanted else "company"
            return institutions[key]
        for needle, payload in routes.items():
            if needle in url:
                return payload
        return {}

    fetch.calls = calls
    return fetch


def test_canonical_institution_applies_aliases():
    assert canonical_institution("unc") == (
        "University of North Carolina at Chapel Hill")
    assert canonical_institution("  Georgia Tech ") == (
        "Georgia Institute of Technology")
    assert canonical_institution("Oberlin College") == "Oberlin College"


def test_resolve_institution_prefers_education(partnership_http):
    institution = resolve_institution("University of North Carolina",
                                      partnership_http)
    assert institution.resolved is True
    assert institution.ror_id == "0130frc33"
    assert institution.name == "University of North Carolina at Chapel Hill"


def test_resolve_institution_failure_falls_back():
    def broken(method, url, params=None, body=None, headers=None):
        raise RuntimeError("down")

    institution = resolve_institution("unc", broken)
    assert institution.resolved is False
    assert institution.name == "University of North Carolina at Chapel Hill"


def test_resolve_partnership_collects_all_evidence(partnership_http):
    result = resolve_partnership("NVDA", "unc", http=partnership_http)
    assert result.company.resolved is True
    assert result.company.name == "NVIDIA"
    assert result.institution.resolved is True

    assert len(result.evidence.papers) > 0
    assert len(result.evidence.trials) == 2
    assert len(result.evidence.faculty_leads) == 2
    assert len(result.evidence.filing_mentions) == 1
    assert all(s.ok for s in result.statuses)


def test_joint_trial_detection(partnership_http):
    result = resolve_partnership("NVDA", "unc", http=partnership_http)
    by_id = {t.nct_id: t for t in result.evidence.trials}
    assert by_id["NCT01000001"].is_joint is True
    assert by_id["NCT01000002"].is_joint is False


def test_signals_rank_confirmed_first(partnership_http):
    result = resolve_partnership("NVDA", "unc", http=partnership_http)
    strengths = [s.strength for s in result.signals]
    assert strengths == sorted(strengths,
                               key=lambda s: 0 if s == "confirmed" else 1)
    kinds = {s.kind for s in result.signals}
    assert "filing_mention" in kinds
    assert "joint_trial" in kinds


def test_one_failing_source_does_not_abort(partnership_http):
    def flaky(method, url, params=None, body=None, headers=None):
        if "reporter.nih" in url:
            raise RuntimeError("nih down")
        return partnership_http(method, url, params=params, body=body,
                                headers=headers)

    result = resolve_partnership("NVDA", "unc", http=flaky)
    statuses = {s.source: s for s in result.statuses}
    assert statuses["nih_reporter"].ok is False
    assert "nih down" in statuses["nih_reporter"].error
    assert statuses["clinicaltrials"].ok is True
    assert result.evidence.faculty_leads == []


def test_detect_signals_empty_evidence_yields_nothing():
    assert detect_signals("A", "B", PartnershipEvidence()) == []


def test_talking_points_rank_and_cap():
    evidence = PartnershipEvidence(
        papers=[CoauthoredPaper(title=f"p{i}", url=f"u{i}", date="2024")
                for i in range(5)],
        trials=[PartnerTrial(nct_id=f"NCT{i}", title="t", status="",
                             date="", url="u", is_joint=True)
                for i in range(5)],
        faculty_leads=[FacultyLead(pi_names=["A"], department="", fiscal_year="2024",
                                   project_num=f"R{i}", title="g",
                                   award_amount=100.0, url="u")
                       for i in range(5)])
    signals = detect_signals("NVIDIA", "UNC", evidence)
    points = build_talking_points("NVIDIA", "UNC", evidence, signals)
    assert len(points) == 8
    strengths = [p.strength for p in points]
    assert strengths == sorted(strengths,
                               key=lambda s: {"high": 0, "medium": 1,
                                              "low": 2}[s])


def test_talking_points_never_empty():
    points = build_talking_points("NVIDIA", "Oberlin College",
                                  PartnershipEvidence(), [])
    assert len(points) == 1
    assert points[0].strength == "low"
    assert "no existing relationship" in points[0].headline
