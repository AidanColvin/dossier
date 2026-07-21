"""company profile: fact banner and XBRL financial history."""
from etl_pipeline.profile import parse_filings, parse_financials

SUBMISSIONS = {
    "cik": 320193,
    "name": "Apple Inc.",
    "filings": {"recent": {
        "form": ["10-K", "8-K"],
        "filingDate": ["2024-11-01", "2024-10-31"],
        "accessionNumber": ["0000320193-24-000123", "0000320193-24-000122"],
        "primaryDocument": ["aapl-20240928.htm", "ex99.htm"],
    }},
}


def _usd(*entries):
    return {"facts": {"us-gaap": {"Revenues": {"units": {"USD": list(entries)}}}}}


def test_parse_filings_builds_archive_urls():
    filings = parse_filings(SUBMISSIONS, "0000320193")
    assert len(filings) == 2
    assert filings[0].form == "10-K"
    assert "000032019324000123/aapl-20240928.htm" in filings[0].url


def test_parse_financials_keeps_only_full_year_10k_figures():
    """quarterly and year-to-date rows must never enter an annual series."""
    facts = _usd(
        {"form": "10-K", "filed": "2024-11-01", "start": "2023-10-01",
         "end": "2024-09-30", "val": 391_000},
        {"form": "10-Q", "filed": "2024-08-01", "start": "2024-04-01",
         "end": "2024-06-30", "val": 90_000},
    )
    assert parse_financials(facts)["revenue"] == {"2024": 391_000.0}


def test_parse_financials_prefers_the_newest_restatement():
    """when a year is reported twice, the later filing wins."""
    facts = _usd(
        {"form": "10-K", "filed": "2023-11-01", "start": "2022-10-01",
         "end": "2023-09-30", "val": 100},
        {"form": "10-K", "filed": "2024-11-01", "start": "2022-10-01",
         "end": "2023-09-30", "val": 111},
    )
    assert parse_financials(facts)["revenue"] == {"2023": 111.0}


def test_parse_financials_returns_nothing_for_a_company_with_no_xbrl():
    assert parse_financials({"facts": {}}) == {}


def _tagged(tag, *entries):
    return {"facts": {"us-gaap": {tag: {"units": {"USD": list(entries)}}}}}


def test_fiscal_year_comes_from_the_period_not_the_filing():
    """a prior-year comparative must not overwrite that year's real figure.

    Both rows below sit in the FY2024 10-K, so both carry fy=2024. Keying on
    fy would collapse them; keying on the period end keeps them apart.
    """
    facts = _tagged(
        "Revenues",
        {"form": "10-K", "fy": "2024", "filed": "2024-11-01",
         "start": "2023-10-01", "end": "2024-09-30", "val": 391_000},
        {"form": "10-K", "fy": "2024", "filed": "2024-11-01",
         "start": "2022-10-01", "end": "2023-09-30", "val": 383_000},
    )
    assert parse_financials(facts)["revenue"] == {"2023": 383_000.0, "2024": 391_000.0}


def test_partial_periods_are_rejected():
    """a quarter and a two-year cumulative are both discarded."""
    facts = _tagged(
        "Revenues",
        {"form": "10-Q", "filed": "2024-08-01",
         "start": "2024-04-01", "end": "2024-06-30", "val": 90_000},
        {"form": "10-K", "filed": "2024-11-01",
         "start": "2022-10-01", "end": "2024-09-30", "val": 770_000},
        {"form": "10-K", "filed": "2024-11-01",
         "start": "2023-10-01", "end": "2024-09-30", "val": 391_000},
    )
    assert parse_financials(facts)["revenue"] == {"2024": 391_000.0}


def test_metrics_share_one_year_window():
    """revenue and net income must not end in different years."""
    facts = {"facts": {"us-gaap": {
        "Revenues": {"units": {"USD": [
            {"form": "10-K", "filed": "2020-01-01", "start": "2018-01-01",
             "end": "2018-12-31", "val": 100},
            {"form": "10-K", "filed": "2025-01-01", "start": "2024-01-01",
             "end": "2024-12-31", "val": 500},
        ]}},
        "NetIncomeLoss": {"units": {"USD": [
            {"form": "10-K", "filed": "2025-01-01", "start": "2024-01-01",
             "end": "2024-12-31", "val": 50},
        ]}},
    }}}
    financials = parse_financials(facts, years=1)
    # 2018 falls outside the shared window, so it is dropped from revenue too.
    assert set(financials["revenue"]) == {"2024"}
    assert set(financials["net_income"]) == {"2024"}


def test_instant_balance_sheet_values_are_kept():
    """Assets has no start date and must still land in the series."""
    facts = _tagged(
        "Assets",
        {"form": "10-K", "filed": "2024-11-01", "end": "2024-09-30", "val": 352_000},
    )
    assert parse_financials(facts)["assets"] == {"2024": 352_000.0}


def test_concepts_are_merged_so_a_series_does_not_stop_early():
    """a company that switched revenue concepts keeps one continuous series.

    The specific tag covers only 2022; the generic one covers the later years.
    Taking the first tag that reported anything would end the series in 2022.
    """
    facts = {"facts": {"us-gaap": {
        "RevenueFromContractWithCustomerExcludingAssessedTax": {"units": {"USD": [
            {"form": "10-K", "filed": "2022-03-01", "start": "2021-02-01",
             "end": "2022-01-31", "val": 26_900},
        ]}},
        "Revenues": {"units": {"USD": [
            {"form": "10-K", "filed": "2026-02-01", "start": "2025-02-01",
             "end": "2026-01-31", "val": 130_500},
        ]}},
    }}}
    revenue = parse_financials(facts)["revenue"]
    assert revenue == {"2022": 26_900.0, "2026": 130_500.0}


def test_the_more_specific_concept_wins_a_shared_year():
    """when both tags cover a year, the earlier (more specific) tag is kept."""
    facts = {"facts": {"us-gaap": {
        "RevenueFromContractWithCustomerExcludingAssessedTax": {"units": {"USD": [
            {"form": "10-K", "filed": "2024-11-01", "start": "2023-10-01",
             "end": "2024-09-30", "val": 391_000},
        ]}},
        "Revenues": {"units": {"USD": [
            {"form": "10-K", "filed": "2024-11-01", "start": "2023-10-01",
             "end": "2024-09-30", "val": 999_999},
        ]}},
    }}}
    assert parse_financials(facts)["revenue"] == {"2024": 391_000.0}
