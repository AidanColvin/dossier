"""tests for the shared company_tickers cache."""
from etl_pipeline.connectors.sec_edgar import clear_tickers_cache, fetch_tickers


def counting_fetcher(payload: dict):
    """
    given a payload to serve
    return a fetcher that counts how many times it is called
    """
    def fetch(method, url, params=None, body=None, headers=None):
        fetch.count += 1
        return payload

    fetch.count = 0
    return fetch


def test_same_fetcher_hits_cache():
    clear_tickers_cache()
    http = counting_fetcher({"0": {"cik_str": 1, "ticker": "A", "title": "A Inc"}})
    first = fetch_tickers(http)
    second = fetch_tickers(http)
    assert first is second
    assert http.count == 1


def test_new_fetcher_refetches():
    clear_tickers_cache()
    old = counting_fetcher({"0": {"ticker": "OLD"}})
    new = counting_fetcher({"0": {"ticker": "NEW"}})
    fetch_tickers(old)
    payload = fetch_tickers(new)
    assert payload["0"]["ticker"] == "NEW"
    assert old.count == 1
    assert new.count == 1


def test_clear_forgets_payload():
    clear_tickers_cache()
    http = counting_fetcher({"0": {"ticker": "A"}})
    fetch_tickers(http)
    clear_tickers_cache()
    fetch_tickers(http)
    assert http.count == 2
