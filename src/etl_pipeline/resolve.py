"""entity resolution: turn a typed query into a known company identity.

this runs before extraction. without it every connector searches the raw
string, so a query like "apple" pulls orchard horticulture out of openalex and
"target" pulls target-organ toxicology out of pubmed — the connectors have no
way to know a company was meant.

resolving first against sec edgar's company_tickers file gives an authoritative
name, ticker and cik. the canonical name is then what the other connectors
search, which is the difference between "apple" and "Apple Inc.".

companies with no sec registration (private firms, foreign issuers, research
institutes) simply do not resolve; the pipeline falls back to the typed string
rather than refusing to run.
"""
from dataclasses import dataclass, field
from typing import Optional

from etl_pipeline.config import Config
from etl_pipeline.connectors.sec_edgar import (
    TICKERS_URL,
    find_cik_for_name,
    find_cik_for_ticker,
    normalize_company,
    pad_cik,
)
from etl_pipeline.http_client import Fetcher
from etl_pipeline.models import Query
from etl_pipeline.text import as_text


@dataclass
class Entity:
    """a resolved company identity, or an unresolved passthrough.

    `resolved` is False when the query matched nothing in edgar, in which case
    `name` is just the text the user typed.
    """

    name: str
    resolved: bool = False
    cik: str = ""
    ticker: str = ""
    query: str = ""
    #: the full legal name as filed with the SEC, e.g. "NVIDIA CORP"
    official: str = ""
    aliases: list[str] = field(default_factory=list)


def display_name(official: str) -> str:
    """
    given an sec company title
    return the name a person would actually write

    edgar stores legal names — "NVIDIA CORP", "Apple Inc.", "LILLY ELI & CO".
    the trailing legal form is dropped and the original casing kept, so
    acronyms stay upper ("NVIDIA") and normal names stay mixed ("Apple").
    research and grant databases also index the short form far more reliably
    than the legal one.
    """
    words = official.replace(",", " ").split()
    while words and normalize_company(words[-1]) == "":
        words.pop()
    # A trailing ampersand is left over from forms like "ELI LILLY & CO".
    while words and words[-1] in {"&", "-"}:
        words.pop()
    return " ".join(words) or official


def _entry_for_cik(tickers: dict, cik: str) -> dict:
    """
    given the company_tickers payload and a padded cik
    return the matching entry, or an empty dict
    """
    for entry in (tickers or {}).values():
        if pad_cik(entry.get("cik_str")) == cik:
            return entry
    return {}


def resolve_entity(query: Query, http: Fetcher, config: Optional[Config] = None) -> Entity:
    """
    given a query and a fetcher
    return the resolved company identity, falling back to the typed text

    an explicit ticker wins over the name, because a ticker is unambiguous and
    a name is not — someone who typed NVDA meant NVIDIA, whatever they put in
    the name field.
    """
    typed = query.entity.strip()
    fallback = Entity(name=typed, resolved=False, query=typed)
    if not typed and not query.ticker.strip():
        return fallback

    try:
        tickers = http("GET", TICKERS_URL)
    except Exception:  # noqa: BLE001 — resolution is best-effort, never fatal
        return fallback

    cik = ""
    if query.ticker.strip():
        cik = find_cik_for_ticker(tickers, query.ticker)
    if not cik:
        cik = find_cik_for_name(tickers, typed)
    if not cik:
        return fallback

    entry = _entry_for_cik(tickers, cik)
    official = as_text(entry.get("title")).strip() or typed
    ticker = as_text(entry.get("ticker")).strip().upper()
    short = display_name(official)

    # Both forms are kept: the legal name is what appears in filings, the short
    # form is what research and grant databases index companies under.
    aliases = [a for a in dict.fromkeys([short, official, typed]) if a]

    return Entity(
        name=short,
        official=official,
        resolved=True,
        cik=cik,
        ticker=ticker,
        query=typed,
        aliases=aliases,
    )


def apply_entity(query: Query, entity: Entity) -> Query:
    """
    given the original query and a resolved entity
    return the query the connectors should actually run

    unresolved entities pass through untouched, so behaviour for anything not
    in edgar is exactly what it was before resolution existed.
    """
    if not entity.resolved:
        return query
    return Query(
        entity=entity.name,
        ticker=entity.ticker or query.ticker,
        max_results=query.max_results,
    )
