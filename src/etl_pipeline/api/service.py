"""glue between the http layer and the pipeline.

keeps request/response translation out of the route handlers so both are easy
to test in isolation.
"""
import json
import queue
import threading
from dataclasses import asdict
from pathlib import Path
from typing import Iterator, Optional

from etl_pipeline.api.schemas import (
    PartnershipResponse,
    RunRequest,
    RunResponse,
    SectorRequest,
)
from etl_pipeline.config import Config
from etl_pipeline.core.pipeline import collect
from etl_pipeline.http_client import Fetcher
from etl_pipeline.models import Query, RunResult, SourceResult, record_from_dict
from etl_pipeline.partnerships.resolver import resolve_partnership
from etl_pipeline.partnerships.talking_points import build_talking_points
from etl_pipeline.sector.orchestrator import run_sector
from etl_pipeline.sector.report import build_report
from etl_pipeline.text import slugify

SSE_HEARTBEAT_SECONDS = 4.0

SAMPLE_PATH = Path(__file__).parent / "sample_data.json"


def query_from_request(request: RunRequest) -> Query:
    """
    given a run request
    return the Query to execute
    """
    return Query(entity=request.entity, ticker=request.ticker,
                 max_results=request.max_results)


def config_from_request(request: RunRequest) -> Config:
    """
    given a run request
    return a Config carrying its result and verification limits
    """
    return Config(max_results_per_source=request.max_results,
                  min_sources_to_verify=request.min_sources)


def run_pipeline(request: RunRequest, http: Fetcher | None = None) -> RunResult:
    """
    given a run request and an optional fetcher
    return the pipeline result for it, without writing files

    the single-company run is the deep one: it also reads the latest 10-K
    and recent form 4s so the profile carries the company's own narrative
    and its named officers. (with an injected offline fetcher, deep mode
    stays off inside collect.)
    """
    return collect(query_from_request(request),
                   sources=request.sources,
                   config=config_from_request(request),
                   http=http,
                   deep_profile=True)


def to_response(result: RunResult) -> RunResponse:
    """
    given a pipeline result
    return the api response model describing it
    """
    return RunResponse(
        entity=result.entity,
        count=len(result.records),
        resolved=result.resolved,
        cik=result.cik,
        ticker=result.ticker,
        query=result.query,
        official=result.official,
        profile=asdict(result.profile) if result.profile else None,
        records=[r.__dict__ for r in result.records],
        sources=[{"source": s.source, "ok": s.ok, "error": s.error,
                  "count": len(s.records)} for s in result.results],
    )


def run_sector_pipeline(request: SectorRequest,
                        http: Fetcher | None = None) -> dict:
    """
    given a sector request and an optional fetcher
    return the finished sector report dict
    """
    run = run_sector(request.sector, http=http, limit=request.max_companies)
    return build_report(run)


def sse_line(kind: str, payload: dict) -> str:
    """
    given an event kind and its payload
    return the wire form of one server-sent event
    """
    return f"event: {kind}\ndata: {json.dumps(payload)}\n\n"


def sector_event_stream(sector: str, http: Fetcher | None = None,
                        max_companies: int = 8,
                        heartbeat_seconds: float = SSE_HEARTBEAT_SECONDS) -> Iterator[str]:
    """
    given a sector and an optional fetcher
    yield the scan as server-sent events, ending with done or error

    the scan runs on a worker thread that pushes events into a queue; this
    generator drains it, inserting a heartbeat whenever the scan goes quiet
    so proxies never see a dead connection.
    """
    events: "queue.Queue[Optional[tuple[str, dict]]]" = queue.Queue()

    def emit(kind: str, payload: dict) -> None:
        events.put((kind, payload))

    def work() -> None:
        try:
            run = run_sector(sector, http=http, emit=emit, limit=max_companies)
            emit("building", {"stage": "building the report"})
            report = build_report(run)
            emit("verifying", {"stage": "checking sources",
                               **report["verification"]})
            emit("done", report)
        except Exception as exc:  # noqa: BLE001 - the stream must end with an event, not a crash
            emit("error", {"message": str(exc)})
        finally:
            events.put(None)

    thread = threading.Thread(target=work, daemon=True)
    thread.start()

    while True:
        try:
            item = events.get(timeout=heartbeat_seconds)
        except queue.Empty:
            yield sse_line("heartbeat", {})
            continue
        if item is None:
            return
        kind, payload = item
        yield sse_line(kind, payload)


def run_partnership_lookup(company: str, institution: str,
                           http: Fetcher | None = None) -> PartnershipResponse:
    """
    given a company and an institution
    return the full partnership payload with ranked talking points
    """
    result = resolve_partnership(company, institution, http=http)
    points = build_talking_points(result.company.name,
                                  result.institution.name,
                                  result.evidence, result.signals)
    return PartnershipResponse(
        company=result.company.name,
        company_resolved=result.company.resolved,
        ticker=result.company.ticker,
        cik=result.company.cik,
        institution=result.institution.name,
        institution_resolved=result.institution.resolved,
        papers=[asdict(p) for p in result.evidence.papers],
        trials=[asdict(t) for t in result.evidence.trials],
        faculty_leads=[asdict(f) for f in result.evidence.faculty_leads],
        filing_mentions=[asdict(m) for m in result.evidence.filing_mentions],
        signals=[asdict(s) for s in result.signals],
        talking_points=[asdict(p) for p in points],
        statuses=[asdict(s) for s in result.statuses],
        elapsed_seconds=result.elapsed_seconds)


def _load_sample() -> dict:
    """
    takes nothing
    return the bundled demo dataset keyed by entity slug
    """
    return json.loads(SAMPLE_PATH.read_text(encoding="utf-8"))


def demo_result(entity: str) -> RunResult:
    """
    given an entity name
    return a pre-baked pipeline result so the ui has data with no network
    """
    dataset = _load_sample()
    entry = dataset.get(slugify(entity)) or next(iter(dataset.values()))
    records = [record_from_dict(row) for row in entry["records"]]
    results = [SourceResult(source=s["source"], ok=s["ok"], error=s["error"],
                            records=[r for r in records if r.source == s["source"]])
               for s in entry["sources"]]
    label = records[0].entity if records else entity
    return RunResult(entity=label, records=records, results=results, outputs={})
