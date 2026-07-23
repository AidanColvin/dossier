"""tests for sector report assembly, using hand-built runs."""
from etl_pipeline.models import Record, RunResult, SourceResult
from etl_pipeline.profile import CompanyProfile
from etl_pipeline.sector.membership import SectorCompany, SectorResolution
from etl_pipeline.sector.orchestrator import CompanyOutcome, SectorRun
from etl_pipeline.sector.report import build_report


def make_record(native_id: str, url: str, verified: bool = True) -> Record:
    return Record(source="openalex", record_type="paper", native_id=native_id,
                  title=f"paper {native_id}", url=url, date="2024-01-01",
                  entity="NVIDIA", sources=[url], verified=verified)


def make_run() -> SectorRun:
    records = [make_record("W1", "https://openalex.org/W1"),
               make_record("W2", "https://openalex.org/W2", verified=False)]
    profile = CompanyProfile(name="NVIDIA", ticker="NVDA", exchange="Nasdaq",
                             industry="Semiconductors", city="Santa Clara",
                             state="CA", ok=True,
                             financials={"revenue": {"2023": 1.0, "2024": 2.0}})
    good = CompanyOutcome(
        company=SectorCompany(ticker="NVDA"),
        result=RunResult(entity="NVIDIA", records=records,
                         results=[SourceResult(source="openalex",
                                               records=records)],
                         resolved=True, cik="0001045810", ticker="NVDA",
                         profile=profile))
    bad = CompanyOutcome(company=SectorCompany(ticker="AMD"), ok=False,
                         error="exceeded budget")
    resolution = SectorResolution(sector="semiconductors", query="chips",
                                  method="curated",
                                  companies=[SectorCompany(ticker="NVDA"),
                                             SectorCompany(ticker="AMD")])
    return SectorRun(resolution=resolution, outcomes=[good, bad],
                     elapsed_seconds=1.5)


def test_report_top_level_shape():
    report = build_report(make_run())
    assert report["sector"] == "semiconductors"
    assert report["method"] == "curated"
    assert {"overview", "companies", "verification",
            "references"} <= set(report)


def test_overview_counts():
    overview = build_report(make_run())["overview"]
    assert overview["companies_total"] == 2
    assert overview["companies_ok"] == 1
    assert overview["records_total"] == 2
    assert overview["records_by_type"] == {"paper": 2}
    assert overview["records_by_source"] == {"openalex": 2}


def test_failed_company_keeps_its_error():
    companies = build_report(make_run())["companies"]
    assert companies[1]["ticker"] == "AMD"
    assert companies[1]["ok"] is False
    assert "budget" in companies[1]["error"]
    assert companies[1]["top_records"] == []


def test_company_facts_pull_latest_year():
    facts = build_report(make_run())["companies"][0]["facts"]
    assert facts["exchange"] == "Nasdaq"
    assert facts["revenue"] == {"year": "2024", "value": 2.0}


def test_verification_ratio():
    verification = build_report(make_run())["verification"]
    assert verification == {"verified": 1, "total": 2, "ratio": 0.5}


def test_references_are_deduped_and_numbered():
    references = build_report(make_run())["references"]
    urls = [r["url"] for r in references]
    assert urls == ["https://openalex.org/W1", "https://openalex.org/W2"]
    assert [r["n"] for r in references] == [1, 2]
