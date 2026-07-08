"""nih reporter connector — federal research grants, keyless.

posts a text search to the v2 projects api for grants that mention the entity
and maps each project to a grant record.

docs: https://api.reporter.nih.gov/
"""
from etl_pipeline.config import Config
from etl_pipeline.connectors.base import empty_result, failed_result, result_limit
from etl_pipeline.http_client import Fetcher
from etl_pipeline.models import Query, Record, SourceResult
from etl_pipeline.text import as_text, collapse_whitespace, dig, first_nonempty

NAME = "nih_reporter"
RECORD_TYPE = "grant"

ENDPOINT = "https://api.reporter.nih.gov/v2/projects/search"
PROJECT_URL = "https://reporter.nih.gov/project-details/{appl_id}"
SEARCH_FIELDS = "projecttitle,terms,abstracttext"


def build_body(entity: str, limit: int) -> dict:
    """
    given an entity and a result limit
    return the json body for a text search of nih projects
    """
    return {
        "criteria": {
            "advanced_text_search": {
                "operator": "and",
                "search_field": SEARCH_FIELDS,
                "search_text": entity,
            }
        },
        "limit": limit,
        "offset": 0,
        "sort_field": "fiscal_year",
        "sort_order": "desc",
    }


def project_url(appl_id: str) -> str:
    """
    given an application id
    return the public project-details url for that grant
    """
    return PROJECT_URL.format(appl_id=appl_id)


def _project_to_record(project: dict, entity: str) -> Record:
    """
    given one project and the entity name
    return a normalized grant record
    """
    appl_id = as_text(project.get("appl_id"))
    url = project_url(appl_id)
    org = as_text(dig(project, "organization", "org_name"))
    return Record(
        source=NAME,
        record_type=RECORD_TYPE,
        native_id=first_nonempty(project.get("project_num"), appl_id),
        title=collapse_whitespace(as_text(project.get("project_title"))),
        url=url,
        date=first_nonempty(project.get("project_start_date"), project.get("fiscal_year")),
        entity=entity,
        sources=[url],
        extra={"organization": org, "fiscal_year": as_text(project.get("fiscal_year"))},
    )


def parse_projects(payload: dict, entity: str) -> list[Record]:
    """
    given a projects response and an entity name
    return one grant record per project that has an application id
    """
    projects = (payload or {}).get("results") or []
    records = [_project_to_record(project, entity) for project in projects]
    return [record for record in records if record.native_id]


def fetch(query: Query, http: Fetcher, config: Config) -> SourceResult:
    """
    given a query, a fetcher, and a config
    return the nih grant records for the query's entity
    """
    if not query.entity.strip():
        return empty_result(NAME)
    try:
        body = build_body(query.entity, result_limit(query, config))
        payload = http("POST", ENDPOINT, body=body)
        return SourceResult(source=NAME, records=parse_projects(payload, query.entity), ok=True)
    except Exception as exc:  # noqa: BLE001 — surfaced as a failed result
        return failed_result(NAME, exc)
