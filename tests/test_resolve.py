"""entity resolution: a typed query becomes a known company identity."""
from etl_pipeline.config import Config
from etl_pipeline.models import Query
from etl_pipeline.resolve import Entity, apply_entity, display_name, resolve_entity

TICKERS = {
    "0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."},
    "1": {"cik_str": 1045810, "ticker": "NVDA", "title": "NVIDIA CORP"},
    "2": {"cik_str": 1750, "ticker": "APLE", "title": "Apple Hospitality REIT, Inc."},
}


def _http(method, url, **kwargs):
    return TICKERS


def test_display_name_drops_the_legal_form():
    assert display_name("NVIDIA CORP") == "NVIDIA"
    assert display_name("Apple Inc.") == "Apple"
    assert display_name("Moderna, Inc.") == "Moderna"


def test_resolve_prefers_the_exact_company_over_a_lookalike():
    """'apple' is Apple Inc., not Apple Hospitality REIT."""
    entity = resolve_entity(Query(entity="apple"), _http, Config())
    assert entity.resolved is True
    assert entity.name == "Apple"
    assert entity.ticker == "AAPL"
    assert entity.cik == "0000320193"


def test_an_explicit_ticker_wins_over_the_name():
    """someone who typed NVDA meant NVIDIA, whatever the name field says."""
    entity = resolve_entity(Query(entity="apple", ticker="NVDA"), _http, Config())
    assert entity.name == "NVIDIA"


def test_unknown_company_passes_through_unresolved():
    """a private company still runs, using the text as typed."""
    entity = resolve_entity(Query(entity="Some Private Lab"), _http, Config())
    assert entity.resolved is False
    assert entity.name == "Some Private Lab"


def test_resolution_failure_is_not_fatal():
    """if EDGAR is unreachable the pipeline still runs on the typed text."""
    def boom(method, url, **kwargs):
        raise RuntimeError("network down")

    entity = resolve_entity(Query(entity="Apple"), boom, Config())
    assert entity.resolved is False
    assert entity.name == "Apple"


def test_apply_entity_rewrites_the_query_for_connectors():
    """connectors search the canonical name, not the typed string."""
    entity = Entity(name="Apple", resolved=True, cik="0000320193", ticker="AAPL")
    rewritten = apply_entity(Query(entity="apple", max_results=7), entity)
    assert rewritten.entity == "Apple"
    assert rewritten.ticker == "AAPL"
    assert rewritten.max_results == 7


def test_apply_entity_leaves_unresolved_queries_untouched():
    original = Query(entity="Some Private Lab", ticker="")
    assert apply_entity(original, Entity(name="Some Private Lab")) is original
