"""extract stage: run each connector and collect one result per source.

connectors are io-bound, so the sources are fetched concurrently. output
order always matches the connector order, keeping runs reproducible.
"""
from concurrent.futures import ThreadPoolExecutor

from etl_pipeline.config import Config
from etl_pipeline.connectors.base import Connector, failed_result
from etl_pipeline.http_client import Fetcher
from etl_pipeline.models import Query, SourceResult


def run_source(connector: Connector, query: Query, http: Fetcher,
               config: Config) -> SourceResult:
    """
    given a connector and the run inputs
    return its SourceResult, turning any unexpected error into a failed result
    """
    try:
        return connector.fetch(query, http, config)
    except Exception as exc:  # noqa: BLE001 — one source must not abort the run
        return failed_result(connector.NAME, exc)


def extract_sequential(connectors: list[Connector], query: Query, http: Fetcher,
                       config: Config) -> list[SourceResult]:
    """
    given connectors and the run inputs
    return one SourceResult per connector, fetched one at a time
    """
    return [run_source(connector, query, http, config) for connector in connectors]


def extract_concurrent(connectors: list[Connector], query: Query, http: Fetcher,
                       config: Config) -> list[SourceResult]:
    """
    given connectors and the run inputs
    return one SourceResult per connector, fetched concurrently in source order
    """
    if not connectors:
        return []
    with ThreadPoolExecutor(max_workers=len(connectors)) as pool:
        futures = [pool.submit(run_source, connector, query, http, config)
                   for connector in connectors]
        return [future.result() for future in futures]
