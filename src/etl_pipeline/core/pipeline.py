"""the run() orchestrator: extract -> transform -> load.

this is the single entry point the cli and library callers use. a fetcher can
be injected so the whole pipeline runs offline in tests.
"""
from typing import Optional

from etl_pipeline.config import Config, load_config
from etl_pipeline.core.extract import extract_concurrent, extract_sequential
from etl_pipeline.core.load import ALL_FORMATS, load
from etl_pipeline.core.transform import transform
from etl_pipeline.http_client import Fetcher, build_fetcher
from etl_pipeline.models import Query, RunResult
from etl_pipeline.registry import resolve_sources
from etl_pipeline.profile import CompanyProfile, fetch_profile
from etl_pipeline.resolve import apply_entity, resolve_entity


def collect(query: Query, sources: Optional[list[str]] = None,
            config: Optional[Config] = None, http: Optional[Fetcher] = None,
            concurrent: bool = True) -> RunResult:
    """
    given a query and options
    run extract and transform only, returning records without writing files

    the entity is resolved against sec edgar first, so every connector searches
    one canonical company name instead of whatever string was typed. this is
    what stops a search for "apple" returning orchard research.
    """
    config = config or load_config()
    connectors = resolve_sources(sources)
    fetch_json = http or build_fetcher(config)

    entity = resolve_entity(query, fetch_json, config)
    resolved_query = apply_entity(query, entity)

    # A resolved company gets its SEC fact banner and financial history. This
    # is what turns a list of records into a company profile, and it is skipped
    # entirely for anything that did not resolve.
    profile = fetch_profile(entity.cik, fetch_json, config) if entity.cik else None

    extract = extract_concurrent if concurrent else extract_sequential
    results = extract(connectors, resolved_query, fetch_json, config)
    records = transform(results, config)

    return RunResult(entity=entity.name, records=records,
                     results=results, outputs={}, resolved=entity.resolved,
                     cik=entity.cik, ticker=entity.ticker, query=entity.query,
                     official=entity.official, profile=profile)


def run(query: Query, sources: Optional[list[str]] = None, out_dir: str = "out",
        formats: Optional[list[str]] = None, config: Optional[Config] = None,
        http: Optional[Fetcher] = None, concurrent: bool = True) -> RunResult:
    """
    given a query and options
    run extract, transform, and load, then return a RunResult
    """
    formats = formats or list(ALL_FORMATS)
    result = collect(query, sources=sources, config=config, http=http,
                     concurrent=concurrent)
    result.outputs = load(result.records, out_dir, query.entity, formats)
    return result
