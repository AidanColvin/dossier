"""shared contract and helpers for source connectors.

each connector module exposes three attributes:
  NAME          the source key, e.g. "sec_edgar"
  RECORD_TYPE   the kind of record it produces, e.g. "filing"
  fetch         fetch(query, http, config) -> SourceResult

a connector reports failure through SourceResult rather than raising, so one
broken source never aborts the whole run.
"""
from typing import Callable, Protocol

from etl_pipeline.config import Config
from etl_pipeline.http_client import Fetcher
from etl_pipeline.models import Query, SourceResult


class Connector(Protocol):
    """structural type every connector module satisfies."""

    NAME: str
    RECORD_TYPE: str
    fetch: Callable[[Query, Fetcher, Config], SourceResult]


def result_limit(query: Query, config: Config) -> int:
    """
    given a query and a config
    return the smaller of the query and config result caps
    """
    return min(query.max_results, config.max_results_per_source)


def empty_result(source: str) -> SourceResult:
    """
    given a source name
    return an empty but successful SourceResult
    """
    return SourceResult(source=source, records=[], ok=True)


def failed_result(source: str, error: Exception) -> SourceResult:
    """
    given a source name and an exception
    return a failed SourceResult carrying the error text
    """
    return SourceResult(source=source, records=[], ok=False, error=str(error))
