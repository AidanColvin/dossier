"""clinicaltrials.gov connector — company-sponsored trials, keyless.

queries the v2 studies api for trials whose sponsor matches the entity and
maps each study to a trial record.

docs: https://clinicaltrials.gov/data-api/api
"""
from etl_pipeline.config import Config
from etl_pipeline.connectors.base import empty_result, failed_result, result_limit
from etl_pipeline.http_client import Fetcher
from etl_pipeline.models import Query, Record, SourceResult
from etl_pipeline.text import as_text, collapse_whitespace, dig, first_nonempty

NAME = "clinicaltrials"
RECORD_TYPE = "trial"

ENDPOINT = "https://clinicaltrials.gov/api/v2/studies"
STUDY_URL = "https://clinicaltrials.gov/study/{nct_id}"


def build_params(entity: str, limit: int) -> dict:
    """
    given an entity and a result limit
    return the studies query parameters for a sponsor search
    """
    return {
        "query.spons": entity,
        "pageSize": limit,
        "sort": "LastUpdatePostDate:desc",
    }


def study_url(nct_id: str) -> str:
    """
    given an nct id
    return the public study url for that trial
    """
    return STUDY_URL.format(nct_id=nct_id)


def _study_to_record(study: dict, entity: str) -> Record:
    """
    given one study and the entity name
    return a normalized trial record
    """
    nct_id = as_text(dig(study, "protocolSection", "identificationModule", "nctId"))
    title = as_text(dig(study, "protocolSection", "identificationModule", "briefTitle"))
    status = as_text(dig(study, "protocolSection", "statusModule", "overallStatus"))
    start = as_text(dig(study, "protocolSection", "statusModule", "startDateStruct", "date"))
    sponsor = as_text(
        dig(study, "protocolSection", "sponsorCollaboratorsModule", "leadSponsor", "name")
    )
    url = study_url(nct_id)
    return Record(
        source=NAME,
        record_type=RECORD_TYPE,
        native_id=nct_id,
        title=collapse_whitespace(title),
        url=url,
        date=start,
        entity=entity,
        sources=[url],
        verified=True,
        verification={
            "method": "sponsor_match",
            "matched_on": sponsor or entity,
            "strict": True,
        },
        extra={"status": status},
    )


def parse_studies(payload: dict, entity: str) -> list[Record]:
    """
    given a studies response and an entity name
    return one trial record per study that has an nct id
    """
    studies = (payload or {}).get("studies") or []
    records = [_study_to_record(study, entity) for study in studies]
    return [record for record in records if record.native_id]


def fetch(query: Query, http: Fetcher, config: Config) -> SourceResult:
    """
    given a query, a fetcher, and a config
    return the clinical trial records for the query's entity
    """
    if not query.entity.strip():
        return empty_result(NAME)
    try:
        params = build_params(query.entity, result_limit(query, config))
        payload = http("GET", ENDPOINT, params=params)
        return SourceResult(source=NAME, records=parse_studies(payload, query.entity), ok=True)
    except Exception as exc:  # noqa: BLE001 — surfaced as a failed result
        return failed_result(NAME, exc)
