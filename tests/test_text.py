"""tests for the small string helpers."""
from etl_pipeline.text import (as_text, collapse_whitespace, dig, first_nonempty,
                               slugify)


def test_as_text_none_becomes_empty():
    assert as_text(None) == ""


def test_as_text_strips_and_stringifies():
    assert as_text("  hi  ") == "hi"
    assert as_text(2024) == "2024"


def test_collapse_whitespace_collapses_runs():
    assert collapse_whitespace("a\n  b\t c") == "a b c"


def test_first_nonempty_returns_first_real_value():
    assert first_nonempty("", None, "  ", "found", "later") == "found"


def test_first_nonempty_returns_empty_when_all_blank():
    assert first_nonempty("", None, "   ") == ""


def test_slugify_makes_safe_slug():
    assert slugify("NVIDIA Corp. (NVDA)") == "nvidia-corp-nvda"


def test_slugify_empty_input():
    assert slugify("   ") == ""


def test_dig_reads_nested_value():
    data = {"a": {"b": {"c": 5}}}
    assert dig(data, "a", "b", "c") == 5


def test_dig_missing_key_returns_none():
    assert dig({"a": {}}, "a", "b", "c") is None


def test_dig_non_dict_midway_returns_none():
    assert dig({"a": 1}, "a", "b") is None
