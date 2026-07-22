"""openalex connector: research works, keyless.

resolves the company to an OpenAlex institution (preferring the US entity of
that name, since Dossier covers US public companies) and returns only works
with an author affiliated to it. keyword search is never used: "apple" the
keyword returns orchard horticulture and Zenodo software dumps, while an
author-affiliation lookup returns the company's actual research.

two further guards keep the set honest:
  1. the institution is chosen with a US bias, so "Apple" resolves to Apple
     (United States) rather than a same-named, more-published foreign cluster
     that OpenAlex has over-aggregated.
  2. non-scholarly work types (software, datasets, GitHub and Zenodo release
     dumps) are dropped, since those carry weak affiliations and are not
     research output.

docs: https://docs.openalex.org/api-entities/works
"""
from etl_pipeline.config import Config
from etl_pipeline.connectors.base import empty_result, failed_result, result_limit
from etl_pipeline.http_client import Fetcher
from etl_pipeline.models import Query, Record, SourceResult
from etl_pipeline.text import as_text, collapse_whitespace, dig, first_nonempty

NAME = "openalex"
RECORD_TYPE = "paper"

ENDPOINT = "https://api.openalex.org/works"
INSTITUTIONS_ENDPOINT = "https://api.openalex.org/institutions"
SELECT = (
    "id,doi,title,type,publication_year,publication_date,"
    "primary_location,open_access"
)

# Over-fetch so that dropping non-scholarly works still leaves a full page.
FETCH_MULTIPLIER = 3

# Work types that count as research output. Everything else (software, dataset,
# libraries, paratext, peer-review, and the rest) is dropped: those are the
# GitHub and Zenodo release records that carry a spurious company affiliation.
SCHOLARLY_TYPES = frozenset(
    {
        "article",
        "review",
        "preprint",
        "conference-paper",
        "book-chapter",
        "book",
        "dissertation",
        "report",
        "letter",
    }
)


def resolve_openalex_institution(entity: str, http: Fetcher) -> tuple[str, str]:
    """
    Takes a company name and a fetcher. Returns (ror_id, display_name), or
    ("", "") when nothing plausible matches.

    Ranks candidates so a US company wins over a same-named foreign cluster and
    over a same-named university. Works count is the last tiebreaker only, so
    an over-aggregated foreign entity never outranks the real US company.
    """
    payload = http(
        "GET",
        INSTITUTIONS_ENDPOINT,
        params={
            "search": entity,
            "per-page": 10,
            "select": "id,display_name,ror,type,country_code,works_count",
        },
    )
    results = (payload or {}).get("results") or []
    if not results:
        return "", ""

    wanted = entity.strip().lower()

    def rank(institution: dict) -> tuple:
        is_company = as_text(institution.get("type")) == "company"
        is_us = as_text(institution.get("country_code")).upper() == "US"
        name = as_text(institution.get("display_name")).lower()
        exact = name.startswith(wanted)
        works = institution.get("works_count") or 0
        return (is_company, is_us, exact, works)

    best = max(results, key=rank)
    # Reject a non-company match that does not even share the name, so a search
    # for a company OpenAlex does not model never inherits a university's whole
    # output.
    name = as_text(best.get("display_name")).lower()
    if as_text(best.get("type")) != "company" and not name.startswith(wanted):
        return "", ""

    ror = as_text(best.get("ror"))
    ror_id = ror.rstrip("/").split("/")[-1] if ror else ""
    return ror_id, as_text(best.get("display_name"))


def build_params(entity: str, limit: int, ror_id: str = "") -> dict:
    """
    Takes an entity, a result limit, and optionally a ROR id. Returns the works
    query parameters. With a ROR the filter is an author-affiliation lookup;
    without one it falls back to matching affiliation display names, which is
    still far stricter than a raw keyword search.
    """
    if ror_id:
        criterion = f"authorships.institutions.ror:{ror_id}"
    else:
        criterion = f"authorships.institutions.display_name.search:{entity}"
    return {
        "filter": criterion,
        "sort": "publication_date:desc",
        "per-page": max(limit * FETCH_MULTIPLIER, limit),
        "select": SELECT,
    }


def work_url(work: dict) -> str:
    """
    Takes a work. Returns its open-access landing url, or its OpenAlex id url.
    """
    landing = as_text(dig(work, "open_access", "oa_url"))
    if landing.startswith("http"):
        return landing
    return as_text(work.get("id"))


def work_sources(work: dict, url: str) -> list[str]:
    """
    Takes a work and its primary url. Returns the distinct provenance urls,
    adding the doi when present.
    """
    doi = as_text(work.get("doi"))
    urls = [url]
    if doi.startswith("http") and doi not in urls:
        urls.append(doi)
    return urls


def is_scholarly(work: dict) -> bool:
    """
    Takes a work. Returns whether its type counts as research output. A missing
    type is treated as scholarly so a data gap never silently drops a record.
    """
    work_type = as_text(work.get("type"))
    return work_type == "" or work_type in SCHOLARLY_TYPES


def _work_to_record(work: dict, entity: str, matched_on: str, strict: bool) -> Record:
    """
    Takes one OpenAlex work, the entity, the match key, and whether the match
    was strict. Returns a normalized paper record with its verification.
    """
    url = work_url(work)
    journal = as_text(dig(work, "primary_location", "source", "display_name"))
    return Record(
        source=NAME,
        record_type=RECORD_TYPE,
        native_id=as_text(work.get("id")),
        title=collapse_whitespace(as_text(work.get("title"))),
        url=url,
        date=first_nonempty(work.get("publication_date"), work.get("publication_year")),
        entity=entity,
        sources=work_sources(work, url),
        verified=strict,
        verification={
            "method": "author_affiliation",
            "matched_on": matched_on,
            "strict": strict,
        },
        extra={"journal": journal, "doi": as_text(work.get("doi")), "type": as_text(work.get("type"))},
    )


def parse_works(
    payload: dict, entity: str, matched_on: str, strict: bool, limit: int
) -> list[Record]:
    """
    Takes an OpenAlex response, the entity, the match key, strictness, and a
    limit. Returns up to `limit` scholarly paper records, deduplicated by
    OpenAlex id, dropping software and dataset dumps.
    """
    works = (payload or {}).get("results") or []
    seen: set[str] = set()
    records: list[Record] = []
    for work in works:
        if not as_text(work.get("title")) or not is_scholarly(work):
            continue
        work_id = as_text(work.get("id"))
        if work_id in seen:
            continue
        seen.add(work_id)
        records.append(_work_to_record(work, entity, matched_on, strict))
        if len(records) >= limit:
            break
    return records


def fetch(query: Query, http: Fetcher, config: Config) -> SourceResult:
    """
    Takes a query, a fetcher, and a config. Returns the OpenAlex paper records
    for the query's entity, matched by author affiliation.
    """
    if not query.entity.strip():
        return empty_result(NAME)
    try:
        # A failed institution lookup degrades to the display-name filter rather
        # than raising, so one API hiccup never loses the whole source.
        try:
            ror_id, _ = resolve_openalex_institution(query.entity, http)
        except Exception:  # noqa: BLE001
            ror_id = ""

        strict = bool(ror_id)
        matched_on = f"ror:{ror_id}" if ror_id else f"name:{query.entity}"
        params = build_params(query.entity, result_limit(query, config), ror_id)
        payload = http("GET", ENDPOINT, params=params)
        records = parse_works(
            payload, query.entity, matched_on, strict, result_limit(query, config)
        )
        return SourceResult(source=NAME, records=records, ok=True)
    except Exception as exc:  # noqa: BLE001 — surfaced as a failed result
        return failed_result(NAME, exc)
