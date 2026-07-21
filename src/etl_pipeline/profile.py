"""company profile: the facts and financials behind a resolved entity.

the record pipeline answers "what has this company produced?". this module
answers "what *is* this company?" — the fact banner (exchange, industry,
headquarters), a multi-year financial series from XBRL, and the most recent
filings.

everything comes from two keyless sec endpoints and is assembled
deterministically. no narrative is generated: the numbers are the company's
own reported figures and the descriptions are edgar's own fields.
"""
from dataclasses import dataclass, field
from typing import Optional

from etl_pipeline.config import Config
from etl_pipeline.http_client import Fetcher
from etl_pipeline.text import as_text, dig

SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik}.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"

# XBRL tags for each metric, in preference order. Companies report under
# different concepts depending on their filing history, so each metric falls
# back through its alternatives until one has data.
METRICS: dict[str, tuple[str, ...]] = {
    "revenue": (
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "Revenues",
        "SalesRevenueNet",
    ),
    "net_income": ("NetIncomeLoss", "ProfitLoss"),
    "research_development": ("ResearchAndDevelopmentExpense",),
    "assets": ("Assets",),
    "equity": ("StockholdersEquity",),
}


@dataclass
class Filing:
    """one recent sec filing."""

    form: str
    filed: str
    accession: str
    url: str


@dataclass
class CompanyProfile:
    """the fact banner and financial history for one company."""

    name: str = ""
    cik: str = ""
    ticker: str = ""
    exchange: str = ""
    industry: str = ""
    sic: str = ""
    city: str = ""
    state: str = ""
    website: str = ""
    fiscal_year_end: str = ""
    employees: str = ""
    #: metric -> {fiscal year: value}, e.g. {"revenue": {"2024": 391035000000}}
    financials: dict[str, dict[str, float]] = field(default_factory=dict)
    filings: list[Filing] = field(default_factory=list)
    ok: bool = False
    error: str = ""


def _address(submissions: dict) -> tuple[str, str]:
    """
    given a submissions payload
    return the business city and state, title-cased — edgar stores them upper
    """
    business = dig(submissions, "addresses", "business") or {}
    city = as_text(business.get("city")).title()
    return city, as_text(business.get("stateOrCountry")).upper()


def parse_filings(submissions: dict, cik: str, limit: int = 8) -> list[Filing]:
    """
    given a submissions payload and a padded cik
    return the most recent filings, newest first

    the recent-filings block is columnar: parallel arrays rather than a list
    of objects, so the row at index i is assembled across the arrays.
    """
    recent = dig(submissions, "filings", "recent") or {}
    forms = recent.get("form") or []
    dates = recent.get("filingDate") or []
    accessions = recent.get("accessionNumber") or []
    documents = recent.get("primaryDocument") or []

    filings: list[Filing] = []
    for index in range(min(len(forms), len(dates), len(accessions))):
        accession = as_text(accessions[index])
        document = as_text(documents[index]) if index < len(documents) else ""
        stripped = accession.replace("-", "")
        url = (
            f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{stripped}/{document}"
            if document
            else f"https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK={cik}"
        )
        filings.append(Filing(form=as_text(forms[index]), filed=as_text(dates[index]),
                              accession=accession, url=url))
        if len(filings) >= limit:
            break
    return filings


def _days_between(start: str, end: str) -> int:
    """
    given two ISO dates
    return the number of days between them, or 0 when either is unparseable
    """
    from datetime import date

    try:
        a = date.fromisoformat(start)
        b = date.fromisoformat(end)
    except ValueError:
        return 0
    return (b - a).days


def _annual_series(facts: dict, tags: tuple[str, ...]) -> dict[str, float]:
    """
    given the companyfacts payload and candidate tags
    return {fiscal year: value} from the first tag that reports annual data

    the fiscal year is taken from the period's own end date, not from the
    entry's `fy` field. `fy` is the fiscal year of the *filing*, so the
    prior-year comparatives inside a 10-K carry the newer filing's `fy` and
    would otherwise overwrite the real figure for that year — which is how a
    revenue series ends up years out of step with net income.

    only durations of roughly a year are kept, so quarterly and year-to-date
    rows can never enter an annual series. balance-sheet tags are instants
    with no start date; those are keyed by their `end` year directly.

    where a year is reported more than once the latest filing wins, so
    restatements are honoured.
    """
    # Merged across tags rather than taking the first that reports anything.
    # Companies change concepts over time — NVIDIA's older revenue sits under
    # one tag and its recent years under another — so first-tag-wins would
    # return a series that stops years before the company's latest filing.
    # Earlier tags are more specific, so they are filled in first and later
    # tags only supply years still missing.
    merged: dict[str, tuple[str, float]] = {}

    for tag in tags:
        units = dig(facts, "facts", "us-gaap", tag, "units", "USD")
        if not units:
            continue

        by_year: dict[str, tuple[str, float]] = {}
        for entry in units:
            value = entry.get("val")
            end = as_text(entry.get("end"))
            if value is None or len(end) < 4:
                continue

            start = as_text(entry.get("start"))
            if start:
                days = _days_between(start, end)
                # A fiscal year runs 52-53 weeks; anything outside that band is
                # a quarter, a half, or a multi-year cumulative figure.
                if not 340 <= days <= 400:
                    continue

            year = end[:4]
            filed = as_text(entry.get("filed"))
            previous = by_year.get(year)
            if previous is None or filed > previous[0]:
                by_year[year] = (filed, float(value))

        for year, row in by_year.items():
            merged.setdefault(year, row)

    return {year: value for year, (_, value) in sorted(merged.items())}


def parse_financials(facts: dict, years: int = 5) -> dict[str, dict[str, float]]:
    """
    given the companyfacts payload
    return the most recent `years` fiscal years of every metric available

    all metrics are clipped to the *same* window of years. computing each
    metric's own latest-N independently would let revenue cover 2019-2022
    while net income covered 2021-2025, and any ratio drawn across the two —
    a margin, say — would then divide figures from different years.
    """
    raw = {metric: _annual_series(facts, tags) for metric, tags in METRICS.items()}
    raw = {metric: annual for metric, annual in raw.items() if annual}
    if not raw:
        return {}

    every_year = sorted({year for annual in raw.values() for year in annual})
    window = set(every_year[-years:])

    return {
        metric: {year: value for year, value in annual.items() if year in window}
        for metric, annual in raw.items()
    }


def fetch_profile(cik: str, http: Fetcher,
                  config: Optional[Config] = None) -> CompanyProfile:
    """
    given a padded cik and a fetcher
    return the company's profile, or an unpopulated one carrying the error

    the financials request is allowed to fail on its own: a company with no
    XBRL history still gets a fact banner and its filing list.
    """
    if not cik:
        return CompanyProfile(error="no cik")
    try:
        submissions = http("GET", SUBMISSIONS_URL.format(cik=cik)) or {}
    except Exception as exc:  # noqa: BLE001 — surfaced on the profile
        return CompanyProfile(cik=cik, error=str(exc))

    city, state = _address(submissions)
    tickers = submissions.get("tickers") or []
    exchanges = submissions.get("exchanges") or []

    profile = CompanyProfile(
        name=as_text(submissions.get("name")),
        cik=cik,
        ticker=as_text(tickers[0]).upper() if tickers else "",
        exchange=as_text(exchanges[0]) if exchanges else "",
        industry=as_text(submissions.get("sicDescription")),
        sic=as_text(submissions.get("sic")),
        city=city,
        state=state,
        website=as_text(submissions.get("website")),
        fiscal_year_end=as_text(submissions.get("fiscalYearEnd")),
        filings=parse_filings(submissions, cik),
        ok=True,
    )

    try:
        facts = http("GET", FACTS_URL.format(cik=cik)) or {}
        profile.financials = parse_financials(facts)
    except Exception:  # noqa: BLE001 — a profile without financials is useful
        profile.financials = {}

    return profile
