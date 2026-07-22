"""nih reporter connector: federal research grants, keyless.

matches on the awardee organization, not on a text search of the project's
title, terms, or abstract. a text search for "apple" over those fields returns
grants from the University of Wisconsin, Charles Drew University, and a dozen
other institutions that merely mention the word somewhere. none of them are
apple's grants. the organization is the only field that says who the money
actually went to.

the api's own `org_names` criterion is itself a loose match ("apple" matches
"appleton area school district" and "applera corporation"), so the real
precision comes from a client-side check: the organization name must equal, or
begin with, the normalized company name. a lookalike prefix within a longer
word never passes.

docs: https://api.reporter.nih.gov/
"""
from etl_pipeline.config import Config
from etl_pipeline.connectors.base import empty_result, failed_result, result_limit
from etl_pipeline.connectors.sec_edgar import normalize_company
from etl_pipeline.http_client import Fetcher
from etl_pipeline.models import Query, Record, SourceResult
from etl_pipeline.text import as_text, collapse_whitespace, dig, first_nonempty

NAME = "nih_reporter"
RECORD_TYPE = "grant"

ENDPOINT = "https://api.reporter.nih.gov/v2/projects/search"
PROJECT_URL = "https://reporter.nih.gov/project-details/{appl_id}"

# The org_names filter over-matches, so the request over-fetches and the real
# cut happens in is_awardee_match. Most public companies have zero genuine NIH
# awards; a handful of biotechs (Regeneron, for one) genuinely do.
FETCH_MULTIPLIER = 4
MIN_FETCH = 40


def build_body(entity: str, limit: int) -> dict:
    """
    Takes an entity and a result limit. Returns the request body for an
    organization-name search, over-fetched since org_names itself is a loose
    match and the strict filter runs after the response lands.
    """
    return {
        "criteria": {"org_names": [entity]},
        "limit": max(limit * FETCH_MULTIPLIER, MIN_FETCH),
        "offset": 0,
        "sort_field": "fiscal_year",
        "sort_order": "desc",
    }


def _is_person_name(org_name: str) -> bool:
    """
    Takes a raw organization name. Returns whether it reads as an individual's
    name rather than an institution: "Apple, Rima D." is how NIH stores some
    older and fellowship awards, where a surname that happens to match the
    company name reads as a real match once punctuation is stripped and the
    prefix check is applied. A real institution's text after a comma is a
    legal suffix or a multi-word department name; a bare first name and
    middle initial is the tell of a person, not a company.
    """
    if "," not in org_name:
        return False
    tail = org_name.split(",", 1)[1].replace(".", "").split()
    return 1 <= len(tail) <= 3 and any(len(word) <= 2 for word in tail)


def is_awardee_match(org_name: str, entity: str) -> bool:
    """
    Takes an organization name and the query entity. Returns whether the
    organization is genuinely the company, rejecting both a same-prefix
    lookalike ("Appleton Area School District" is not "Apple") and an
    individual investigator whose surname happens to match ("Apple, Rima D."
    is not Apple Inc.). "Regeneron Pharmaceuticals, Inc." starts with the
    word "regeneron" and reads as an institution, so it is accepted.
    """
    if _is_person_name(org_name):
        return False
    org = normalize_company(org_name)
    want = normalize_company(entity)
    if not org or not want:
        return False
    return org == want or org.startswith(f"{want} ")


def project_url(appl_id: str) -> str:
    """Takes an application id. Returns the public project-details url."""
    return PROJECT_URL.format(appl_id=appl_id)


def _project_to_record(project: dict, entity: str, org: str) -> Record:
    """
    Takes one project, the entity, and its confirmed matching organization
    name. Returns a normalized grant record.
    """
    appl_id = as_text(project.get("appl_id"))
    url = project_url(appl_id)
    return Record(
        source=NAME,
        record_type=RECORD_TYPE,
        native_id=first_nonempty(project.get("project_num"), appl_id),
        title=collapse_whitespace(as_text(project.get("project_title"))),
        url=url,
        date=first_nonempty(project.get("project_start_date"), project.get("fiscal_year")),
        entity=entity,
        sources=[url],
        verified=True,
        verification={"method": "awardee_match", "matched_on": org, "strict": True},
        extra={"organization": org, "fiscal_year": as_text(project.get("fiscal_year"))},
    )


def parse_projects(payload: dict, entity: str, limit: int) -> list[Record]:
    """
    Takes a projects response, the entity, and a limit. Returns up to `limit`
    grant records whose awardee organization is genuinely the company. A
    project that merely mentions the company's name elsewhere is dropped
    rather than shown as a lookalike grant.
    """
    projects = (payload or {}).get("results") or []
    records: list[Record] = []
    for project in projects:
        org = as_text(dig(project, "organization", "org_name"))
        if not is_awardee_match(org, entity):
            continue
        appl_id = as_text(project.get("appl_id"))
        if not appl_id and not as_text(project.get("project_num")):
            continue
        records.append(_project_to_record(project, entity, org))
        if len(records) >= limit:
            break
    return records


def fetch(query: Query, http: Fetcher, config: Config) -> SourceResult:
    """
    Takes a query, a fetcher, and a config. Returns the NIH grant records
    genuinely awarded to the query's entity. Most public companies have none:
    NIH funds academic and research institutions, not corporations, and a
    correct empty result is worth more than a page of unrelated grants.
    """
    if not query.entity.strip():
        return empty_result(NAME)
    try:
        limit = result_limit(query, config)
        body = build_body(query.entity, limit)
        payload = http("POST", ENDPOINT, body=body)
        return SourceResult(source=NAME, records=parse_projects(payload, query.entity, limit), ok=True)
    except Exception as exc:  # noqa: BLE001 - surfaced as a failed result
        return failed_result(NAME, exc)
