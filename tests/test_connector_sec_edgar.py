"""tests for the sec edgar connector."""
from etl_pipeline.config import Config
from etl_pipeline.connectors import sec_edgar
from etl_pipeline.models import Query
from tests.conftest import load_fixture


def test_pad_cik_zero_pads():
    assert sec_edgar.pad_cik(1045810) == "0001045810"


def test_pad_cik_handles_blank():
    assert sec_edgar.pad_cik(None) == ""


def test_find_cik_for_ticker_matches_case_insensitively():
    tickers = load_fixture("sec_company_tickers.json")
    assert sec_edgar.find_cik_for_ticker(tickers, "nvda") == "0001045810"


def test_find_cik_for_ticker_missing_returns_blank():
    tickers = load_fixture("sec_company_tickers.json")
    assert sec_edgar.find_cik_for_ticker(tickers, "ZZZZ") == ""


def test_build_filing_url_strips_dashes_and_leading_zeros():
    url = sec_edgar.build_filing_url("0001045810", "0001045810-24-000029", "d.htm")
    assert url == "https://www.sec.gov/Archives/edgar/data/1045810/000104581024000029/d.htm"


def test_build_filing_url_without_document_points_at_folder():
    url = sec_edgar.build_filing_url("0001045810", "0001045810-24-000029", "")
    assert url == "https://www.sec.gov/Archives/edgar/data/1045810/000104581024000029"


def test_submissions_url_uses_padded_cik():
    assert sec_edgar.submissions_url("0001045810") == \
        "https://data.sec.gov/submissions/CIK0001045810.json"


def test_parse_filings_maps_rows(query):
    submissions = load_fixture("sec_submissions.json")
    records = sec_edgar.parse_filings(submissions, "NVIDIA", limit=10)
    assert len(records) == 3
    first = records[0]
    assert first.record_type == "filing"
    assert first.extra["form"] == "10-K"
    assert first.date == "2024-02-21"
    assert "sec.gov" in first.url


def test_parse_filings_respects_limit():
    submissions = load_fixture("sec_submissions.json")
    assert len(sec_edgar.parse_filings(submissions, "NVIDIA", limit=1)) == 1


def test_fetch_without_ticker_resolves_by_name(fake_http):
    """no ticker is no longer a dead end: the entity name resolves the cik."""
    result = sec_edgar.fetch(Query(entity="NVIDIA"), fake_http, Config())
    assert result.ok is True
    assert len(result.records) > 0


def test_fetch_without_ticker_or_entity_is_empty_ok(fake_http):
    """with nothing to resolve from, the source is skipped rather than failed."""
    result = sec_edgar.fetch(Query(entity=""), fake_http, Config())
    assert result.ok is True
    assert result.records == []


def test_fetch_happy_path(query, fake_http):
    result = sec_edgar.fetch(query, fake_http, Config())
    assert result.ok is True
    assert len(result.records) == 3
    assert all(r.source == "sec_edgar" for r in result.records)


def test_fetch_unknown_ticker_is_empty(fake_http):
    result = sec_edgar.fetch(Query(entity="X", ticker="ZZZZ"), fake_http, Config())
    assert result.ok is True
    assert result.records == []


def test_fetch_reports_http_failure(query):
    def boom(method, url, params=None, body=None, headers=None):
        raise RuntimeError("network down")

    result = sec_edgar.fetch(query, boom, Config())
    assert result.ok is False
    assert "network down" in result.error


def test_normalize_company_strips_legal_suffixes():
    """company titles and typed names compare equal once normalized."""
    assert sec_edgar.normalize_company("Apple Inc.") == "apple"
    assert sec_edgar.normalize_company("NVIDIA CORP") == "nvidia"
    assert sec_edgar.normalize_company("The Coca-Cola Company") == "coca cola"


def test_find_cik_for_name_prefers_exact_title_match():
    """'Apple' resolves to Apple Inc., not to Apple Hospitality REIT."""
    tickers = {
        "0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."},
        "1": {"cik_str": 1750, "ticker": "APLE", "title": "Apple Hospitality REIT, Inc."},
    }
    assert sec_edgar.find_cik_for_name(tickers, "Apple") == "0000320193"


def test_find_cik_for_name_returns_blank_when_no_match():
    """an unknown company yields no cik rather than a wrong one."""
    tickers = {"0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."}}
    assert sec_edgar.find_cik_for_name(tickers, "Moderna") == ""


def test_find_cik_for_name_resolves_household_brands():
    """'google' reaches Alphabet even though no sec title contains it."""
    tickers = {
        "0": {"cik_str": 1652044, "ticker": "GOOGL", "title": "Alphabet Inc."},
        "1": {"cik_str": 1326801, "ticker": "META", "title": "Meta Platforms, Inc."},
        "2": {"cik_str": 1744489, "ticker": "DIS", "title": "Walt Disney Co"},
    }
    assert sec_edgar.find_cik_for_name(tickers, "google") == "0001652044"
    assert sec_edgar.find_cik_for_name(tickers, "YouTube") == "0001652044"
    assert sec_edgar.find_cik_for_name(tickers, "Facebook") == "0001326801"
    assert sec_edgar.find_cik_for_name(tickers, "Disney") == "0001744489"
    # a brand whose ticker is absent from the payload falls through cleanly.
    assert sec_edgar.find_cik_for_name({"0": tickers["0"]}, "Facebook") == ""


def test_fetch_resolves_by_entity_name_without_a_ticker():
    """a search with no ticker still returns filings, matched by name."""
    calls = []

    def fake_http(method, url, **kwargs):
        calls.append(url)
        if url == sec_edgar.TICKERS_URL:
            return {"0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."}}
        return {
            "cik": 320193,
            "name": "Apple Inc.",
            "filings": {"recent": {
                "accessionNumber": ["0000320193-24-000001"],
                "form": ["10-K"],
                "filingDate": ["2024-11-01"],
                "reportDate": ["2024-09-28"],
                "primaryDocument": ["aapl.htm"],
                "primaryDocDescription": ["Annual report"],
            }},
        }

    query = Query(entity="Apple", ticker="")
    result = sec_edgar.fetch(query, fake_http, Config())
    assert result.ok
    assert len(result.records) == 1
    assert result.records[0].record_type == "filing"
