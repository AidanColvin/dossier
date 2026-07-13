"""tests for the connector registry."""
import pytest

from etl_pipeline.registry import (available_sources, get_connector,
                                   resolve_sources)


def test_available_sources_lists_all_four():
    assert available_sources() == ["clinicaltrials", "nih_reporter",
                                   "openalex", "sec_edgar"]


def test_get_connector_returns_module_with_fetch():
    connector = get_connector("openalex")
    assert connector.NAME == "openalex"
    assert callable(connector.fetch)


def test_get_connector_unknown_raises():
    with pytest.raises(KeyError):
        get_connector("bogus")


def test_resolve_sources_none_returns_all():
    assert len(resolve_sources(None)) == 4


def test_resolve_sources_subset_in_order():
    names = [c.NAME for c in resolve_sources(["nih_reporter", "sec_edgar"])]
    assert names == ["nih_reporter", "sec_edgar"]
