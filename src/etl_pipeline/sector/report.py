"""deterministic sector report assembly.

pure template work over data the pipeline already collected: counts, tables,
per-company sections, and a deduped reference list. every displayed record
keeps its primary-source url and nothing here invents a single word of prose.
"""
from collections import Counter
from typing import Any, Optional

from etl_pipeline.models import Record, RunResult
from etl_pipeline.sector.orchestrator import CompanyOutcome, SectorRun

TOP_RECORDS_PER_COMPANY = 5


def latest_metric(profile: Any, metric: str) -> Optional[dict]:
    """
    given a company profile and a metric name
    return {"year", "value"} for its newest fiscal year, or None
    """
    series = (getattr(profile, "financials", None) or {}).get(metric) or {}
    if not series:
        return None
    year = max(series)
    return {"year": year, "value": series[year]}


def record_row(record: Record) -> dict:
    """
    given one pipeline record
    return the compact row shape the report displays
    """
    return {
        "source": record.source,
        "record_type": record.record_type,
        "title": record.title,
        "url": record.url,
        "date": record.date,
        "verified": record.verified,
    }


def company_section(outcome: CompanyOutcome) -> dict:
    """
    given one company outcome
    return its report section, including a clear failure note when the run
    did not complete
    """
    company = outcome.company
    section = {
        "ticker": company.ticker,
        "name": company.name,
        "ok": outcome.ok,
        "error": outcome.error,
        "resolved": False,
        "cik": company.cik,
        "record_count": 0,
        "facts": {},
        "sources": [],
        "top_records": [],
    }
    result = outcome.result
    if result is None:
        return section

    section["name"] = result.entity or company.name
    section["resolved"] = result.resolved
    section["cik"] = result.cik or company.cik
    section["record_count"] = len(result.records)
    section["sources"] = [
        {"source": s.source, "ok": s.ok, "count": len(s.records),
         "error": s.error}
        for s in result.results
    ]
    section["top_records"] = [record_row(r)
                              for r in result.records[:TOP_RECORDS_PER_COMPANY]]

    profile = result.profile
    if profile is not None and getattr(profile, "ok", False):
        section["facts"] = {
            "exchange": profile.exchange,
            "industry": profile.industry,
            "city": profile.city,
            "state": profile.state,
            "revenue": latest_metric(profile, "revenue"),
            "net_income": latest_metric(profile, "net_income"),
        }
    return section


def collect_records(run: SectorRun) -> list[Record]:
    """
    given a completed sector run
    return every record across all successful companies, in company order
    """
    records: list[Record] = []
    for outcome in run.outcomes:
        if outcome.result is not None:
            records.extend(outcome.result.records)
    return records


def overview_section(run: SectorRun, records: list[Record]) -> dict:
    """
    given the run and its records
    return the aggregate counts the report opens with
    """
    by_type = Counter(r.record_type for r in records)
    by_source = Counter(r.source for r in records)
    return {
        "companies_total": len(run.outcomes),
        "companies_ok": sum(1 for o in run.outcomes if o.ok),
        "records_total": len(records),
        "records_by_type": dict(sorted(by_type.items())),
        "records_by_source": dict(sorted(by_source.items())),
        "elapsed_seconds": run.elapsed_seconds,
    }


def verification_section(records: list[Record]) -> dict:
    """
    given the run's records
    return the aggregate verification stats
    """
    verified = sum(1 for r in records if r.verified)
    total = len(records)
    return {
        "verified": verified,
        "total": total,
        "ratio": round(verified / total, 3) if total else 0.0,
    }


def references_section(records: list[Record]) -> list[dict]:
    """
    given the run's records
    return a numbered, deduped list of every provenance url cited
    """
    seen: dict[str, None] = {}
    for record in records:
        for url in [record.url, *record.sources]:
            if url and url not in seen:
                seen[url] = None
    return [{"n": index, "url": url}
            for index, url in enumerate(seen, start=1)]


def build_report(run: SectorRun) -> dict:
    """
    given a completed sector run
    return the full report as one json-ready dict
    """
    records = collect_records(run)
    return {
        "sector": run.resolution.sector,
        "query": run.resolution.query,
        "method": run.resolution.method,
        "overview": overview_section(run, records),
        "companies": [company_section(o) for o in run.outcomes],
        "verification": verification_section(records),
        "references": references_section(records),
    }
