"""openalex connector — research works, keyless.

searches works whose raw author affiliation strings mention the entity, so a
company or institution surfaces as a real co-author's employer rather than a
stray word in an abstract.

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
SELECT = "id,doi,title,publication_year,publication_date,primary_location,open_access"


def build_params(entity: str, limit: int) -> dict:
    """
    given an entity and a result limit
    return the openalex query parameters for affiliation-matched works
    """
    return {
        "filter": f"raw_affiliation_strings.search:{entity}",
        "sort": "publication_year:desc",
        "per-page": limit,
        "select": SELECT,
    }


def work_url(work: dict) -> str:
    """
    given a work
    return its open-access landing url, falling back to its openalex id url
    """
    landing = as_text(dig(work, "open_access", "oa_url"))
    if landing.startswith("http"):
        return landing
    return as_text(work.get("id"))


def work_sources(work: dict, url: str) -> list[str]:
    """
    given a work and its primary url
    return the distinct provenance urls, adding the doi when present
    """
    doi = as_text(work.get("doi"))
    urls = [url]
    if doi.startswith("http") and doi not in urls:
        urls.append(doi)
    return urls


def _work_to_record(work: dict, entity: str) -> Record:
    """
    given one openalex work and the entity name
    return a normalized paper record
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
        extra={"journal": journal, "doi": as_text(work.get("doi"))},
    )


def parse_works(payload: dict, entity: str) -> list[Record]:
    """
    given an openalex response and an entity name
    return one paper record per work that has a title
    """
    works = (payload or {}).get("results") or []
    return [_work_to_record(work, entity) for work in works
            if as_text(work.get("title"))]


def fetch(query: Query, http: Fetcher, config: Config) -> SourceResult:
    """
    given a query, a fetcher, and a config
    return the openalex paper records for the query's entity
    """
    if not query.entity.strip():
        return empty_result(NAME)
    try:
        params = build_params(query.entity, result_limit(query, config))
        payload = http("GET", ENDPOINT, params=params)
        return SourceResult(source=NAME, records=parse_works(payload, query.entity), ok=True)
    except Exception as exc:  # noqa: BLE001 — surfaced as a failed result
        return failed_result(NAME, exc)
