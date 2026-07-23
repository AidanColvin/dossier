"""sec edgar connector — company filings, keyless.

resolves a stock ticker to a central index key (cik) via the public
company_tickers file, then reads the company's recent filings from the
submissions api and maps each one to a filing record.

docs: https://www.sec.gov/edgar/sec-api-documentation
"""
import threading
import time

from etl_pipeline.config import Config
from etl_pipeline.connectors.base import empty_result, failed_result, result_limit
from etl_pipeline.http_client import Fetcher
from etl_pipeline.models import Query, Record, SourceResult
from etl_pipeline.text import as_text, collapse_whitespace, first_nonempty

NAME = "sec_edgar"
RECORD_TYPE = "filing"

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{document}"
SEC_HOME = "https://www.sec.gov"

TICKERS_CACHE_TTL_SECONDS = 900.0

# the tickers file is static for hours, yet entity resolution and this
# connector both need it, so one run used to fetch it twice and a sector
# scan many times over. the cache is keyed on the fetcher instance itself:
# every test injects a fresh fake fetcher, so no payload ever leaks from
# one test into another.
_tickers_lock = threading.Lock()
_tickers_cache: dict = {"http": None, "payload": None, "expires": 0.0}


def fetch_tickers(http: Fetcher) -> dict:
    """
    given a fetcher
    return the company_tickers payload, cached briefly per fetcher instance
    """
    with _tickers_lock:
        if (_tickers_cache["http"] is http
                and time.monotonic() < _tickers_cache["expires"]):
            return _tickers_cache["payload"]
    payload = http("GET", TICKERS_URL)
    with _tickers_lock:
        _tickers_cache["http"] = http
        _tickers_cache["payload"] = payload
        _tickers_cache["expires"] = time.monotonic() + TICKERS_CACHE_TTL_SECONDS
    return payload


def clear_tickers_cache() -> None:
    """
    takes nothing
    forget any cached tickers payload, mainly for tests
    """
    with _tickers_lock:
        _tickers_cache["http"] = None
        _tickers_cache["payload"] = None
        _tickers_cache["expires"] = 0.0


def pad_cik(cik: object) -> str:
    """
    given a central index key
    return it as a zero-padded 10-digit string
    """
    digits = "".join(ch for ch in as_text(cik) if ch.isdigit())
    return digits.zfill(10) if digits else ""


def find_cik_for_ticker(tickers: dict, ticker: str) -> str:
    """
    given the company_tickers payload and a ticker
    return the padded cik whose ticker matches, or '' when none match
    """
    wanted = ticker.strip().upper()
    for entry in (tickers or {}).values():
        if as_text(entry.get("ticker")).upper() == wanted:
            return pad_cik(entry.get("cik_str"))
    return ""


# legal-form suffixes that appear in sec company titles but never in the way
# a person types a company name ("Apple" vs "Apple Inc.")
_SUFFIXES = (
    "incorporated", "inc", "corporation", "corp", "company", "co",
    "limited", "ltd", "plc", "lp", "llc", "holdings", "holding", "group",
    "the", "sa", "nv", "ag",
)


def normalize_company(name: str) -> str:
    """
    given a company name from either the user or the sec tickers file
    return a comparable form: lowercased, punctuation dropped, and trailing
    legal-form suffixes removed, so 'Apple' matches 'Apple Inc.'
    """
    cleaned = "".join(ch if ch.isalnum() or ch.isspace() else " " for ch in name.lower())
    words = [w for w in cleaned.split() if w]
    while words and words[-1] in _SUFFIXES:
        words.pop()
    while words and words[0] in _SUFFIXES:
        words.pop(0)
    return " ".join(words)


def find_cik_for_name(tickers: dict, name: str) -> str:
    """
    given the company_tickers payload and a company name
    return the padded cik of the best title match, or '' when none match

    prefers an exact normalized match; falls back to a title that starts with
    the requested name, which catches 'Alphabet' -> 'Alphabet Inc.' without
    matching every company that merely contains the word
    """
    wanted = normalize_company(name)
    if not wanted:
        return ""
    prefix = ""
    for entry in (tickers or {}).values():
        title = normalize_company(as_text(entry.get("title")))
        if title == wanted:
            return pad_cik(entry.get("cik_str"))
        if not prefix and title.startswith(f"{wanted} "):
            prefix = pad_cik(entry.get("cik_str"))
    return prefix


def resolve_cik(ticker: str, http: Fetcher, config: Config, entity: str = "") -> str:
    """
    given a ticker and optionally the entity name
    return the company's padded cik by reading the public tickers file

    the ticker is authoritative when supplied; otherwise the entity name is
    matched against the company titles, so a search for a company nobody
    remembers the ticker for still returns its filings
    """
    tickers = fetch_tickers(http)
    if ticker.strip():
        by_ticker = find_cik_for_ticker(tickers, ticker)
        if by_ticker:
            return by_ticker
    return find_cik_for_name(tickers, entity)


def submissions_url(cik: str) -> str:
    """
    given a padded cik
    return the submissions api url for that company
    """
    return SUBMISSIONS_URL.format(cik=cik)


def fetch_submissions(cik: str, http: Fetcher, config: Config) -> dict:
    """
    given a padded cik
    return the company's submissions payload
    """
    return http("GET", submissions_url(cik)) or {}


def build_filing_url(cik: str, accession: str, document: str) -> str:
    """
    given a cik, accession number, and primary document
    return the canonical archive url for that filing
    """
    bare_cik = str(int(cik)) if cik.isdigit() else cik
    folder = accession.replace("-", "")
    if not document:
        return f"{ARCHIVE_URL.format(cik=bare_cik, accession=folder, document='')}".rstrip("/")
    return ARCHIVE_URL.format(cik=bare_cik, accession=folder, document=document)


def _recent_rows(submissions: dict) -> list[dict]:
    """
    given a submissions payload
    return its recent filings transposed into per-filing row dicts
    """
    recent = ((submissions.get("filings") or {}).get("recent")) or {}
    forms = recent.get("form") or []
    rows: list[dict] = []
    for index in range(len(forms)):
        rows.append({
            "form": _at(recent, "form", index),
            "accession": _at(recent, "accessionNumber", index),
            "filing_date": _at(recent, "filingDate", index),
            "report_date": _at(recent, "reportDate", index),
            "document": _at(recent, "primaryDocument", index),
            "description": _at(recent, "primaryDocDescription", index),
        })
    return rows


def _at(columns: dict, key: str, index: int) -> str:
    """
    given a columnar dict, a column name, and an index
    return the value at that position as text, or '' when out of range
    """
    values = columns.get(key) or []
    if index < len(values):
        return as_text(values[index])
    return ""


def _row_to_record(row: dict, cik: str, entity: str) -> Record:
    """
    given one filing row, the cik, and the entity name
    return a normalized filing record
    """
    url = build_filing_url(cik, row["accession"], row["document"])
    label = f"{row['form']} filed {row['filing_date']}"
    if row["description"]:
        label = f"{label}: {row['description']}"
    title = collapse_whitespace(label)
    return Record(
        source=NAME,
        record_type=RECORD_TYPE,
        native_id=row["accession"],
        title=title,
        url=url,
        date=first_nonempty(row["filing_date"], row["report_date"]),
        entity=entity,
        sources=[url, SEC_HOME],
        verified=True,
        verification={"method": "cik_match", "matched_on": cik, "strict": True},
        extra={"form": row["form"], "report_date": row["report_date"]},
    )


def parse_filings(submissions: dict, entity: str, limit: int) -> list[Record]:
    """
    given a submissions payload, an entity name, and a result limit
    return up to `limit` filing records
    """
    label = first_nonempty(entity, submissions.get("name"))
    rows = _recent_rows(submissions)
    return [_row_to_record(row, pad_cik(submissions.get("cik")), label)
            for row in rows[:limit] if row["accession"]]


def fetch(query: Query, http: Fetcher, config: Config) -> SourceResult:
    """
    given a query, a fetcher, and a config
    return the sec filing records for the query's ticker, or for its entity
    name when no ticker was supplied
    """
    if not query.ticker.strip() and not query.entity.strip():
        return empty_result(NAME)
    try:
        cik = resolve_cik(query.ticker, http, config, query.entity)
        if not cik:
            return empty_result(NAME)
        submissions = fetch_submissions(cik, http, config)
        records = parse_filings(submissions, query.entity, result_limit(query, config))
        return SourceResult(source=NAME, records=records, ok=True)
    except Exception as exc:  # noqa: BLE001 — surfaced as a failed result
        return failed_result(NAME, exc)
