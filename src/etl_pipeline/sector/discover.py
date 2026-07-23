"""live sector discovery via sec edgar full-text search.

when a sector has no curated seed list, the fallback is to ask edgar which
companies used the phrase in a recent annual report. that keeps discovery
primary-source and keyless, at the cost of some recall on niche phrasings.

docs: https://efts.sec.gov/LATEST/search-index?q=...&forms=10-K
"""
import re

from etl_pipeline.config import Config
from etl_pipeline.http_client import Fetcher
from etl_pipeline.text import as_text, dig

FULL_TEXT_SEARCH_URL = "https://efts.sec.gov/LATEST/search-index"

# edgar's display_names entries look like:
#   "Apple Inc.  (AAPL)  (CIK 0000320193)"
#   "Some Private Fund LLC  (CIK 0001234567)"
DISPLAY_NAME_PATTERN = re.compile(
    r"^(?P<name>.*?)\s*(?:\((?P<ticker>[A-Z][A-Z0-9.\-]{0,9})\)\s*)?"
    r"\(CIK\s+(?P<cik>\d+)\)\s*$")


def parse_display_name(display: str) -> dict:
    """
    given one edgar display_names string
    return {name, ticker, cik}, or an empty dict when it does not parse
    """
    match = DISPLAY_NAME_PATTERN.match(as_text(display).strip())
    if not match:
        return {}
    return {
        "name": match.group("name").strip(),
        "ticker": (match.group("ticker") or "").strip(),
        "cik": match.group("cik").zfill(10),
    }


def discover_companies(sector: str, http: Fetcher, config: Config,
                       limit: int) -> list[dict]:
    """
    given a sector phrase and a fetcher
    return up to limit {name, ticker, cik} dicts of 10-K filers using it,
    or an empty list when the search fails or finds nothing

    only listed companies (a ticker present) are kept: the scan pipeline
    profiles companies through their sec financials, which a fund or shell
    filer without a ticker does not have in a usable form.
    """
    try:
        payload = http("GET", FULL_TEXT_SEARCH_URL,
                       params={"q": f'"{sector}"', "forms": "10-K"})
    except Exception:  # noqa: BLE001 - discovery is best-effort, never fatal
        return []

    companies: list[dict] = []
    seen_ciks: set[str] = set()
    for hit in dig(payload, "hits", "hits") or []:
        for display in dig(hit, "_source", "display_names") or []:
            parsed = parse_display_name(display)
            if not parsed or not parsed["ticker"]:
                continue
            if parsed["cik"] in seen_ciks:
                continue
            seen_ciks.add(parsed["cik"])
            companies.append(parsed)
            if len(companies) >= limit:
                return companies
    return companies
