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
INSTITUTIONS_ENDPOINT = "https://api.openalex.org/institutions"
SELECT = "id,doi,title,publication_year,publication_date,primary_location,open_access"


def find_institution(entity: str, http: Fetcher) -> str:
    """
    given an entity name
    return its openalex institution id, or '' when nothing matches

    openalex models companies as institutions, so an id turns a keyword search
    into an authorship lookup. that is the whole difference between "apple"
    returning Apple's machine-learning papers and returning apple horticulture.

    a company entity is preferred over a same-named university or hospital, and
    among equals the most published one wins, which reliably picks the parent
    company over its national subsidiaries.
    """
    payload = http("GET", INSTITUTIONS_ENDPOINT, params={
        "search": entity,
        "per-page": 10,
        "select": "id,display_name,type,works_count",
    })
    results = (payload or {}).get("results") or []
    if not results:
        return ""

    def rank(institution: dict) -> tuple:
        is_company = as_text(institution.get("type")) == "company"
        exact = as_text(institution.get("display_name")).lower().startswith(
            entity.lower())
        works = institution.get("works_count") or 0
        return (is_company, exact, works)

    best = max(results, key=rank)
    # Never accept a non-company match that does not even share the name — that
    # is how a search for a private lab would silently return a university's
    # entire output.
    if as_text(best.get("type")) != "company" and not as_text(
            best.get("display_name")).lower().startswith(entity.lower()):
        return ""
    return as_text(best.get("id"))


def build_params(entity: str, limit: int, institution_id: str = "") -> dict:
    """
    given an entity, a result limit, and optionally an openalex institution id
    return the query parameters for the works request

    with an institution the filter is an authorship lookup; without one it
    falls back to matching raw affiliation strings, so entities openalex does
    not model still return something.
    """
    if institution_id:
        criterion = f"authorships.institutions.lineage:{institution_id}"
    else:
        criterion = f"raw_affiliation_strings.search:{entity}"
    return {
        "filter": criterion,
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
        # A failed institution lookup must not lose the whole source, so it
        # degrades to the affiliation-string filter rather than raising.
        try:
            institution_id = find_institution(query.entity, http)
        except Exception:  # noqa: BLE001
            institution_id = ""
        params = build_params(query.entity, result_limit(query, config),
                              institution_id)
        payload = http("GET", ENDPOINT, params=params)
        return SourceResult(source=NAME, records=parse_works(payload, query.entity), ok=True)
    except Exception as exc:  # noqa: BLE001 — surfaced as a failed result
        return failed_result(NAME, exc)
