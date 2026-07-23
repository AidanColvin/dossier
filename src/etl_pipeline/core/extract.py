"""extract stage: run each connector and collect one result per source.

connectors are io-bound, so the sources are fetched concurrently. output
order always matches the connector order, keeping runs reproducible.
"""
import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FutureTimeoutError
from typing import Optional

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
                       config: Config,
                       timeout: Optional[float] = None) -> list[SourceResult]:
    """
    given connectors and the run inputs, plus an optional per-source timeout
    return one SourceResult per connector, fetched concurrently in source order

    the timeout is one shared deadline for the whole stage, not a fresh clock
    per source. any source still running at the deadline becomes a failed
    result instead of stalling the run. None keeps the old behaviour of
    waiting as long as the connectors' own retries take.
    """
    if not connectors:
        return []
    deadline = None if timeout is None else time.monotonic() + timeout
    with ThreadPoolExecutor(max_workers=len(connectors)) as pool:
        futures = [pool.submit(run_source, connector, query, http, config)
                   for connector in connectors]
        results = []
        for connector, future in zip(connectors, futures):
            remaining = None if deadline is None else max(0.0, deadline - time.monotonic())
            try:
                results.append(future.result(timeout=remaining))
            except FutureTimeoutError:
                results.append(failed_result(
                    connector.NAME,
                    TimeoutError(f"source exceeded {timeout}s deadline")))
        return results
