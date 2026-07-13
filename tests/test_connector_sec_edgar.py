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


def test_fetch_without_ticker_is_empty_ok(fake_http):
    result = sec_edgar.fetch(Query(entity="NVIDIA"), fake_http, Config())
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
