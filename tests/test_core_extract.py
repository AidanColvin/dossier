"""tests for the extract stage."""
import time

from etl_pipeline.config import Config
from etl_pipeline.core.extract import (extract_concurrent, extract_sequential,
                                       run_source)
from etl_pipeline.models import Query, Record, SourceResult
from etl_pipeline.registry import resolve_sources


class GoodConnector:
    NAME = "good"

    @staticmethod
    def fetch(query, http, config):
        return SourceResult(source="good", records=[
            Record(source="good", record_type="t", native_id="1", title="x",
                   url="u", date="", entity=query.entity)])


class BrokenConnector:
    NAME = "broken"

    @staticmethod
    def fetch(query, http, config):
        raise RuntimeError("kaboom")


def test_run_source_catches_exception():
    result = run_source(BrokenConnector, Query(entity="e"), None, Config())
    assert result.ok is False
    assert "kaboom" in result.error


def test_extract_sequential_returns_one_result_per_connector(query, fake_http):
    results = extract_sequential(resolve_sources(None), query, fake_http, Config())
    assert len(results) == 4
    assert all(r.ok for r in results)


def test_extract_concurrent_preserves_source_order(query, fake_http):
    connectors = resolve_sources(None)
    results = extract_concurrent(connectors, query, fake_http, Config())
    assert [r.source for r in results] == [c.NAME for c in connectors]


def test_extract_concurrent_empty_connectors():
    assert extract_concurrent([], Query(entity="e"), None, Config()) == []


def test_extract_isolates_one_failure(query, fake_http):
    connectors = [GoodConnector, BrokenConnector]
    results = extract_concurrent(connectors, query, fake_http, Config())
    assert results[0].ok is True
    assert results[1].ok is False


class SlowConnector:
    NAME = "slow"

    @staticmethod
    def fetch(query, http, config):
        time.sleep(0.5)
        return SourceResult(source="slow")


def test_extract_concurrent_times_out_slow_source(query, fake_http):
    connectors = [GoodConnector, SlowConnector]
    results = extract_concurrent(connectors, query, fake_http, Config(),
                                 timeout=0.05)
    assert results[0].ok is True
    assert results[1].ok is False
    assert "deadline" in results[1].error


def test_extract_concurrent_no_timeout_waits(query, fake_http):
    results = extract_concurrent([SlowConnector], query, fake_http, Config())
    assert results[0].ok is True
