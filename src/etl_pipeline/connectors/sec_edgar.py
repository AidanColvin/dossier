"""sec edgar connector — company filings, keyless.

resolves a stock ticker to a central index key (cik) via the public
company_tickers file, then reads the company's recent filings from the
submissions api and maps each one to a filing record.

docs: https://www.sec.gov/edgar/sec-api-documentation
"""
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


def resolve_cik(ticker: str, http: Fetcher, config: Config) -> str:
    """
    given a ticker
    return the company's padded cik by reading the public tickers file
    """
    tickers = http("GET", TICKERS_URL)
    return find_cik_for_ticker(tickers, ticker)


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
    title = collapse_whitespace(
        f"{row['form']} filed {row['filing_date']} — {row['description']}".rstrip(" —"))
    return Record(
        source=NAME,
        record_type=RECORD_TYPE,
        native_id=row["accession"],
        title=title,
        url=url,
        date=first_nonempty(row["filing_date"], row["report_date"]),
        entity=entity,
        sources=[url, SEC_HOME],
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
    return the sec filing records for the query's ticker
    """
    if not query.ticker.strip():
        return empty_result(NAME)
    try:
        cik = resolve_cik(query.ticker, http, config)
        if not cik:
            return empty_result(NAME)
        submissions = fetch_submissions(cik, http, config)
        records = parse_filings(submissions, query.entity, result_limit(query, config))
        return SourceResult(source=NAME, records=records, ok=True)
    except Exception as exc:  # noqa: BLE001 — surfaced as a failed result
        return failed_result(NAME, exc)
