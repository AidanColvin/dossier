"""glue between the http layer and the pipeline.

keeps request/response translation out of the route handlers so both are easy
to test in isolation.
"""
import json
from dataclasses import asdict
from pathlib import Path

from etl_pipeline.api.schemas import RunRequest, RunResponse
from etl_pipeline.config import Config
from etl_pipeline.core.pipeline import collect
from etl_pipeline.http_client import Fetcher
from etl_pipeline.models import Query, RunResult, SourceResult, record_from_dict
from etl_pipeline.text import slugify

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
    """
    return collect(query_from_request(request),
                   sources=request.sources,
                   config=config_from_request(request),
                   http=http)


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
