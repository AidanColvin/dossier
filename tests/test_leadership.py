"""tests for form 4 executive extraction, over a bundled filing."""
from etl_pipeline.leadership import (
    extract_leadership,
    fix_name_order,
    fix_title_case,
    parse_form4,
    title_rank,
)
from etl_pipeline.profile import Filing
from tests.conftest import FIXTURES

FORM4 = (FIXTURES / "form4_sample.xml").read_text(encoding="utf-8")


def test_fix_name_order_reorders_and_titles():
    assert fix_name_order("HUANG JEN HSUN") == "Jen Hsun Huang"
    assert fix_name_order("FORD WILLIAM CLAY JR") == "William Clay Ford Jr"
    assert fix_name_order("Madonna") == "Madonna"


def test_fix_title_case_keeps_acronyms_and_joiners():
    assert fix_title_case("PRESIDENT AND CEO") == "President and CEO"
    assert fix_title_case("EVP AND CHIEF FINANCIAL OFFICER") == (
        "EVP and Chief Financial Officer")


def test_title_rank_orders_seniority():
    assert title_rank("President and CEO") < title_rank("EVP and Chief Financial Officer")
    assert title_rank("Some Unknown Role") > title_rank("Vice President")


def test_parse_form4_keeps_officers_drops_directors():
    leaders = parse_form4(FORM4)
    names = [leader.name for leader in leaders]
    assert "Jen Hsun Huang" in names
    assert "Colette M Kress" in names
    assert all("Board Member" not in name for name in names)


def test_extract_leadership_ranks_and_dedupes():
    filings = [Filing(form="4", filed="2026-01-02", accession="a1",
                      url="https://www.sec.gov/Archives/f4a.xml"),
               Filing(form="10-K", filed="2026-01-01", accession="a2",
                      url="https://www.sec.gov/Archives/tenk.htm"),
               Filing(form="4", filed="2025-12-30", accession="a3",
                      url="https://www.sec.gov/Archives/f4b.xml")]
    calls = []

    def fetch_text(url):
        calls.append(url)
        return FORM4

    leaders = extract_leadership(filings, fetch_text)
    # only the two form 4 urls are fetched, never the 10-K.
    assert calls == ["https://www.sec.gov/Archives/f4a.xml",
                     "https://www.sec.gov/Archives/f4b.xml"]
    # duplicates across the two filings collapse; the ceo ranks first.
    assert [l.name for l in leaders] == ["Jen Hsun Huang", "Colette M Kress"]


def test_one_unreadable_filing_is_skipped():
    filings = [Filing(form="4", filed="2026-01-02", accession="a1",
                      url="https://www.sec.gov/Archives/bad.xml"),
               Filing(form="4", filed="2026-01-01", accession="a2",
                      url="https://www.sec.gov/Archives/good.xml")]

    def fetch_text(url):
        if "bad" in url:
            raise RuntimeError("boom")
        return FORM4

    leaders = extract_leadership(filings, fetch_text)
    assert len(leaders) == 2
