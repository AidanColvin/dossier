"""tests for 10-K narrative extraction, over a bundled synthetic filing."""
from etl_pipeline.narrative import (
    excerpt,
    extract_narrative,
    html_to_text,
    risk_headlines,
    slice_items,
)
from tests.conftest import FIXTURES

TENK = (FIXTURES / "tenk_sample.html").read_text(encoding="utf-8")


def test_html_to_text_strips_tags_and_decodes_entities():
    text = html_to_text(TENK)
    assert "<" not in text
    assert "tracking" not in text
    # &#8217; decodes to a real apostrophe.
    assert "Management’s Discussion" in text


def test_slice_items_keeps_the_section_not_the_toc_line():
    items = slice_items(html_to_text(TENK))
    assert "computing infrastructure company" in items["1"]
    assert "accelerated computing" in items["1A"]
    assert "record" in items["7"]
    # the table-of-contents "Item 1. Business" line is one short block; the
    # real section is far longer and must win.
    assert len(items["1"]) > 200


def test_extract_narrative_shape():
    narrative = extract_narrative(TENK)
    assert narrative["business"].startswith("NVIDIA is a computing")
    assert narrative["business"].endswith(".")
    assert len(narrative["risk_headlines"]) == 3
    assert narrative["risk_headlines"][0] == "Risks Related to Our Industry and Markets"
    assert "revenue was a record" in narrative["outlook"]


def test_excerpt_trims_to_a_sentence_inside_budget():
    text = "First sentence here. " * 100
    cut = excerpt(text, 200)
    assert len(cut) <= 200
    assert cut.endswith(".")


def test_risk_headlines_rejects_prose_lines():
    block = ("Risks Related to Competition\n"
             "this is a long flowing prose sentence that happens to sit on its own "
             "line but ends with a period.\n"
             "Risks Related to Cybersecurity and Data Privacy Threats")
    lines = risk_headlines(block)
    assert lines == ["Risks Related to Competition",
                     "Risks Related to Cybersecurity and Data Privacy Threats"]


def test_missing_items_yield_empty_fields():
    narrative = extract_narrative("<html><body><p>no items here</p></body></html>")
    assert narrative == {"business": "", "risk_headlines": [], "outlook": ""}
