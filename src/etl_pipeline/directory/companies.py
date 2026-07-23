"""fetch, filter, sort, and export the listed-company directory.

one keyless fetch of company_tickers_exchange.json yields every listed
company with its exchange. the payload is cached per fetcher exactly like
the tickers file, so repeated directory queries within a deployment do
not refetch a file that changes at most daily.
"""
import csv
import io
import threading
import time
from typing import Optional

from etl_pipeline.http_client import Fetcher
from etl_pipeline.text import as_text

EXCHANGE_TICKERS_URL = "https://www.sec.gov/files/company_tickers_exchange.json"

DIRECTORY_CACHE_TTL_SECONDS = 3600.0

SORT_FIELDS = frozenset({"name", "ticker", "exchange", "cik"})

_cache_lock = threading.Lock()
_cache: dict = {"http": None, "companies": None, "expires": 0.0}


def parse_companies(payload: dict) -> list[dict]:
    """
    given the company_tickers_exchange payload
    return one {cik, name, ticker, exchange} dict per listed company

    the file is columnar: a fields list naming the columns and a data list
    of rows. parsing by field name keeps this correct even if the sec
    reorders the columns.
    """
    fields = [as_text(f) for f in (payload or {}).get("fields") or []]
    if not fields:
        return []
    companies = []
    for row in (payload or {}).get("data") or []:
        entry = dict(zip(fields, row))
        ticker = as_text(entry.get("ticker")).upper()
        if not ticker:
            continue
        cik = as_text(entry.get("cik"))
        companies.append({
            "cik": cik.zfill(10) if cik.isdigit() else cik,
            "name": as_text(entry.get("name")),
            "ticker": ticker,
            "exchange": as_text(entry.get("exchange")),
        })
    return companies


def fetch_directory(http: Fetcher) -> list[dict]:
    """
    given a fetcher
    return every listed company, cached briefly per fetcher instance
    """
    with _cache_lock:
        if (_cache["http"] is http
                and time.monotonic() < _cache["expires"]):
            return _cache["companies"]
    companies = parse_companies(http("GET", EXCHANGE_TICKERS_URL))
    with _cache_lock:
        _cache["http"] = http
        _cache["companies"] = companies
        _cache["expires"] = time.monotonic() + DIRECTORY_CACHE_TTL_SECONDS
    return companies


def clear_directory_cache() -> None:
    """
    takes nothing
    forget any cached directory payload, mainly for tests
    """
    with _cache_lock:
        _cache["http"] = None
        _cache["companies"] = None
        _cache["expires"] = 0.0


def query_directory(companies: list[dict], search: str = "",
                    exchange: str = "", sort: str = "name",
                    order: str = "asc", limit: int = 50,
                    offset: int = 0) -> dict:
    """
    given the full company list and query options
    return {total, companies} for one page of matches

    search matches name or ticker, case-insensitive. total counts every
    match before paging, so the table can say "N companies" while showing
    one page.
    """
    wanted = search.strip().lower()
    wanted_exchange = exchange.strip().lower()

    matches = [c for c in companies
               if (not wanted
                   or wanted in c["name"].lower()
                   or wanted in c["ticker"].lower())
               and (not wanted_exchange
                    or c["exchange"].lower() == wanted_exchange)]

    key = sort if sort in SORT_FIELDS else "name"
    matches.sort(key=lambda c: (c[key] == "", c[key].lower()
                                if isinstance(c[key], str) else c[key]),
                 reverse=(order == "desc"))

    return {"total": len(matches),
            "companies": matches[offset:offset + limit]}


def directory_csv(companies: list[dict]) -> str:
    """
    given a list of directory companies
    return them as csv text with a header row
    """
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer,
                            fieldnames=["cik", "name", "ticker", "exchange"])
    writer.writeheader()
    writer.writerows(companies)
    return buffer.getvalue()


def list_exchanges(companies: list[dict]) -> list[str]:
    """
    given the full company list
    return the distinct non-empty exchanges, sorted
    """
    return sorted({c["exchange"] for c in companies if c["exchange"]})
