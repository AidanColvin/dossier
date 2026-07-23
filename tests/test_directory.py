"""tests for the company directory, driven entirely offline."""
import pytest
from fastapi.testclient import TestClient

from etl_pipeline.api.app import app, get_fetcher
from etl_pipeline.directory.companies import (
    clear_directory_cache,
    directory_csv,
    fetch_directory,
    list_exchanges,
    parse_companies,
    query_directory,
)
from tests.conftest import load_fixture


@pytest.fixture
def directory_http():
    """a fetcher serving the bundled exchange-annotated tickers file."""
    payload = load_fixture("sec_company_tickers_exchange.json")

    def fetch(method, url, params=None, body=None, headers=None):
        fetch.count += 1
        return payload

    fetch.count = 0
    clear_directory_cache()
    return fetch


def test_parse_drops_unlisted_and_pads_cik(directory_http):
    companies = fetch_directory(directory_http)
    assert len(companies) == 6
    tickers = {c["ticker"] for c in companies}
    assert "" not in tickers
    apple = next(c for c in companies if c["ticker"] == "AAPL")
    assert apple["cik"] == "0000320193"


def test_parse_is_column_order_independent():
    payload = {"fields": ["ticker", "cik", "exchange", "name"],
               "data": [["AAPL", 320193, "Nasdaq", "Apple Inc."]]}
    companies = parse_companies(payload)
    assert companies[0]["name"] == "Apple Inc."
    assert companies[0]["cik"] == "0000320193"


def test_fetch_is_cached_per_fetcher(directory_http):
    fetch_directory(directory_http)
    fetch_directory(directory_http)
    assert directory_http.count == 1


def test_query_searches_name_and_ticker(directory_http):
    companies = fetch_directory(directory_http)
    by_name = query_directory(companies, search="micro")
    assert [c["ticker"] for c in by_name["companies"]] == ["MSFT"]
    by_ticker = query_directory(companies, search="nvda")
    assert [c["ticker"] for c in by_ticker["companies"]] == ["NVDA"]


def test_query_filters_by_exchange_and_pages(directory_http):
    companies = fetch_directory(directory_http)
    nyse = query_directory(companies, exchange="NYSE")
    assert nyse["total"] == 2
    paged = query_directory(companies, limit=2, offset=2)
    assert paged["total"] == 6
    assert len(paged["companies"]) == 2


def test_query_sorts_and_reverses(directory_http):
    companies = fetch_directory(directory_http)
    ascending = query_directory(companies, sort="ticker")
    descending = query_directory(companies, sort="ticker", order="desc")
    assert [c["ticker"] for c in descending["companies"]] == list(
        reversed([c["ticker"] for c in ascending["companies"]]))


def test_unknown_sort_falls_back_to_name(directory_http):
    companies = fetch_directory(directory_http)
    result = query_directory(companies, sort="market_cap")
    names = [c["name"] for c in result["companies"]]
    assert names == sorted(names, key=str.lower)


def test_csv_has_header_and_rows(directory_http):
    companies = fetch_directory(directory_http)
    text = directory_csv(companies)
    lines = text.strip().splitlines()
    assert lines[0] == "cik,name,ticker,exchange"
    assert len(lines) == 7


def test_list_exchanges(directory_http):
    companies = fetch_directory(directory_http)
    assert list_exchanges(companies) == ["NYSE", "Nasdaq"]


@pytest.fixture
def client(directory_http):
    """a test client whose directory routes use the offline fetcher."""
    app.dependency_overrides[get_fetcher] = lambda: directory_http
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_directory_endpoint(client):
    body = client.get("/directory", params={"search": "apple"}).json()
    assert body["total"] == 1
    assert body["companies"][0]["ticker"] == "AAPL"
    assert "Nasdaq" in body["exchanges"]


def test_directory_csv_endpoint(client):
    response = client.get("/directory.csv", params={"exchange": "NYSE"})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    lines = response.text.strip().splitlines()
    assert len(lines) == 3
