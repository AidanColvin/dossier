"""tests for sector membership resolution, driven entirely offline."""
from etl_pipeline.config import Config
from etl_pipeline.sector.discover import parse_display_name
from etl_pipeline.sector.membership import (
    METHOD_CURATED,
    METHOD_DEFAULT,
    METHOD_DISCOVERED,
    resolve_sector,
)
from etl_pipeline.sector.seeds import DEFAULT_SEEDS, canonical_sector


def failing_http(method, url, params=None, body=None, headers=None):
    raise RuntimeError("network down")


def test_canonical_sector_applies_aliases():
    assert canonical_sector("  Chips ") == "semiconductors"
    assert canonical_sector("Pharma") == "pharmaceuticals"
    assert canonical_sector("Quantum Basket Weaving") == "quantum basket weaving"


def test_curated_sector_skips_discovery():
    resolution = resolve_sector("semiconductors", failing_http, Config(), limit=3)
    assert resolution.method == METHOD_CURATED
    assert [c.ticker for c in resolution.companies] == ["NVDA", "AMD", "INTC"]


def test_alias_reaches_curated_seeds():
    resolution = resolve_sector("chips", failing_http, Config(), limit=2)
    assert resolution.method == METHOD_CURATED
    assert resolution.sector == "semiconductors"


def test_unknown_sector_uses_discovery(fake_http):
    resolution = resolve_sector("quantum sensing", fake_http, Config())
    assert resolution.method == METHOD_DISCOVERED
    tickers = [c.ticker for c in resolution.companies]
    assert tickers == ["NVDA", "AAPL"]
    # the fixture's fund filer has no ticker and must be filtered out; the
    # duplicate nvidia hit must be deduped by cik.
    assert len(tickers) == len(set(tickers))


def test_discovery_failure_falls_back_to_defaults():
    resolution = resolve_sector("quantum sensing", failing_http, Config())
    assert resolution.method == METHOD_DEFAULT
    assert [c.ticker for c in resolution.companies] == DEFAULT_SEEDS


def test_company_list_is_never_empty(fake_http):
    for text in ["semiconductors", "quantum sensing", ""]:
        resolution = resolve_sector(text, fake_http, Config())
        assert resolution.companies


def test_limit_caps_curated_seeds():
    resolution = resolve_sector("banking", failing_http, Config(), limit=2)
    assert len(resolution.companies) == 2


def test_parse_display_name_variants():
    parsed = parse_display_name("Apple Inc.  (AAPL)  (CIK 0000320193)")
    assert parsed == {"name": "Apple Inc.", "ticker": "AAPL",
                      "cik": "0000320193"}
    fund = parse_display_name("Quiet Private Fund LLC  (CIK 9999999)")
    assert fund["ticker"] == ""
    assert fund["cik"] == "0009999999"
    assert parse_display_name("garbage with no cik") == {}
