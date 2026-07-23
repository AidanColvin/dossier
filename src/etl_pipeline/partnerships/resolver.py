"""the partnership resolver: fan out four evidence lookups concurrently.

each lookup is independent and best-effort: one failing source becomes an
empty evidence list and a noted status, never a failed request. the same
thread-pool idiom as the extract stage keeps the whole module consistent
with the rest of the pipeline.
"""
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Optional

from etl_pipeline.config import Config
from etl_pipeline.connectors.clinicaltrials import ENDPOINT as CT_ENDPOINT
from etl_pipeline.connectors.clinicaltrials import study_url
from etl_pipeline.connectors.nih_reporter import ENDPOINT as NIH_ENDPOINT
from etl_pipeline.connectors.nih_reporter import project_url
from etl_pipeline.connectors.openalex import ENDPOINT as WORKS_ENDPOINT
from etl_pipeline.connectors.openalex import resolve_openalex_institution
from etl_pipeline.connectors.sec_edgar import build_filing_url
from etl_pipeline.http_client import Fetcher, build_fetcher
from etl_pipeline.models import Query
from etl_pipeline.partnerships.institutions import Institution, resolve_institution
from etl_pipeline.partnerships.signals import (
    CoauthoredPaper,
    FacultyLead,
    FilingMention,
    PartnerTrial,
    PartnershipEvidence,
    RelationshipSignal,
    detect_signals,
)
from etl_pipeline.resolve import Entity, resolve_entity
from etl_pipeline.sector.discover import FULL_TEXT_SEARCH_URL
from etl_pipeline.text import as_text, collapse_whitespace, dig

RESULTS_PER_LOOKUP = 10
LOOKUP_WORKERS = 4


def partnership_config() -> Config:
    """
    takes nothing
    return a Config with budgets tight enough for a four-way fan-out
    """
    return Config(http_timeout_seconds=6, http_max_retries=2,
                  http_backoff_seconds=0.3)


@dataclass
class LookupStatus:
    """the outcome of one evidence lookup."""

    source: str
    ok: bool = True
    error: str = ""
    count: int = 0


@dataclass
class PartnershipResult:
    """everything a partnership query produced, ready for the http layer."""

    company: Entity
    institution: Institution
    evidence: PartnershipEvidence
    signals: list[RelationshipSignal] = field(default_factory=list)
    statuses: list[LookupStatus] = field(default_factory=list)
    elapsed_seconds: float = 0.0


def fetch_coauthored_papers(company_name: str, institution: Institution,
                            http: Fetcher) -> list[CoauthoredPaper]:
    """
    given the company name, the institution, and a fetcher
    return recent works with authors at both, newest first

    both sides resolve to openalex institution ids, so the filter is a real
    affiliation intersection rather than a text search. an unresolvable
    company on openalex means no defensible co-authorship claim, so the
    answer is empty rather than approximate.
    """
    company_ror, _ = resolve_openalex_institution(company_name, http)
    if not company_ror or not institution.ror_id:
        return []
    payload = http("GET", WORKS_ENDPOINT, params={
        "filter": (f"authorships.institutions.ror:{company_ror},"
                   f"authorships.institutions.ror:{institution.ror_id}"),
        "sort": "publication_date:desc",
        "per-page": RESULTS_PER_LOOKUP,
        "select": "id,doi,title,publication_date,primary_location,open_access",
    })
    papers = []
    for work in (payload or {}).get("results") or []:
        landing = as_text(dig(work, "open_access", "oa_url"))
        url = landing if landing.startswith("http") else as_text(work.get("id"))
        papers.append(CoauthoredPaper(
            title=collapse_whitespace(as_text(work.get("title"))),
            url=url,
            date=as_text(work.get("publication_date")),
            journal=as_text(dig(work, "primary_location", "source",
                                "display_name"))))
    return papers


def fetch_partner_trials(company_name: str, institution: Institution,
                         http: Fetcher) -> list[PartnerTrial]:
    """
    given the company name, the institution, and a fetcher
    return the company's trials that involve the institution

    the query asks clinicaltrials.gov for the company's sponsored studies
    whose text mentions the institution; is_joint is then decided from the
    named collaborator list, the only field strong enough to call a
    collaboration confirmed.
    """
    payload = http("GET", CT_ENDPOINT, params={
        "query.spons": company_name,
        "query.term": f'"{institution.name}"',
        "pageSize": RESULTS_PER_LOOKUP,
    })
    wanted = institution.name.lower()
    trials = []
    for study in (payload or {}).get("studies") or []:
        nct_id = as_text(dig(study, "protocolSection", "identificationModule",
                             "nctId"))
        if not nct_id:
            continue
        collaborators = dig(study, "protocolSection",
                            "sponsorCollaboratorsModule", "collaborators") or []
        is_joint = any(wanted in as_text(c.get("name")).lower()
                       for c in collaborators)
        trials.append(PartnerTrial(
            nct_id=nct_id,
            title=collapse_whitespace(as_text(
                dig(study, "protocolSection", "identificationModule",
                    "briefTitle"))),
            status=as_text(dig(study, "protocolSection", "statusModule",
                               "overallStatus")),
            date=as_text(dig(study, "protocolSection", "statusModule",
                             "startDateStruct", "date")),
            url=study_url(nct_id),
            is_joint=is_joint))
    return trials


def fetch_faculty_leads(company_name: str, institution: Institution,
                        http: Fetcher) -> list[FacultyLead]:
    """
    given the company name, the institution, and a fetcher
    return grants at the institution whose project text names the company,
    newest fiscal year first
    """
    payload = http("POST", NIH_ENDPOINT, body={
        "criteria": {
            "org_names": [institution.name],
            "advanced_text_search": {
                "operator": "and",
                "search_field": "projecttitle,abstracttext",
                "search_text": company_name,
            },
        },
        "limit": RESULTS_PER_LOOKUP,
        "offset": 0,
        "sort_field": "fiscal_year",
        "sort_order": "desc",
    })
    leads = []
    for project in (payload or {}).get("results") or []:
        appl_id = as_text(project.get("appl_id"))
        pi_names = [collapse_whitespace(as_text(pi.get("full_name")))
                    for pi in project.get("principal_investigators") or []]
        leads.append(FacultyLead(
            pi_names=[name for name in pi_names if name],
            department=as_text(dig(project, "organization", "dept_type")),
            project_num=as_text(project.get("project_num")),
            title=collapse_whitespace(as_text(project.get("project_title"))),
            fiscal_year=as_text(project.get("fiscal_year")),
            award_amount=project.get("award_amount"),
            url=project_url(appl_id)))
    return leads


def fetch_filing_mentions(company: Entity, institution: Institution,
                          http: Fetcher) -> list[FilingMention]:
    """
    given the resolved company, the institution, and a fetcher
    return the company's filings whose full text mentions the institution

    scoped by cik so the search can only ever return the company's own
    filings; without a resolved cik there is no defensible way to attribute
    a mention, so the answer is empty.
    """
    if not company.cik:
        return []
    payload = http("GET", FULL_TEXT_SEARCH_URL, params={
        "q": f'"{institution.name}"',
        "ciks": company.cik,
    })
    mentions = []
    for hit in dig(payload, "hits", "hits") or []:
        source = hit.get("_source") or {}
        accession = as_text(source.get("adsh"))
        if not accession:
            continue
        forms = source.get("root_forms") or []
        mentions.append(FilingMention(
            form=as_text(forms[0]) if forms else as_text(source.get("file_type")),
            filed=as_text(source.get("file_date")),
            accession=accession,
            url=build_filing_url(company.cik, accession, "")))
    return mentions


def resolve_partnership(company_text: str, institution_text: str,
                        http: Optional[Fetcher] = None,
                        config: Optional[Config] = None) -> PartnershipResult:
    """
    given a company and an institution, both as typed text
    resolve each, run the four evidence lookups concurrently, and return
    the full result with ranked relationship signals
    """
    config = config or partnership_config()
    fetch_json = http or build_fetcher(config)
    started = time.monotonic()

    # the typed text doubles as the ticker candidate, so "NVDA" and "NVIDIA"
    # both resolve: an explicit ticker match wins, anything else falls back
    # to the name lookup.
    company = resolve_entity(Query(entity=company_text, ticker=company_text),
                             fetch_json, config)
    institution = resolve_institution(institution_text, fetch_json)

    lookups = [
        ("openalex", fetch_coauthored_papers,
         (company.name, institution, fetch_json)),
        ("clinicaltrials", fetch_partner_trials,
         (company.name, institution, fetch_json)),
        ("nih_reporter", fetch_faculty_leads,
         (company.name, institution, fetch_json)),
        ("sec_edgar", fetch_filing_mentions,
         (company, institution, fetch_json)),
    ]

    evidence = PartnershipEvidence()
    statuses: list[LookupStatus] = []
    with ThreadPoolExecutor(max_workers=LOOKUP_WORKERS) as pool:
        futures = [(source, pool.submit(fn, *args))
                   for source, fn, args in lookups]
        results: dict[str, list] = {}
        for source, future in futures:
            try:
                found = future.result()
                results[source] = found
                statuses.append(LookupStatus(source=source, count=len(found)))
            except Exception as exc:  # noqa: BLE001 - one source must not abort the lookup
                results[source] = []
                statuses.append(LookupStatus(source=source, ok=False,
                                             error=str(exc)))

    evidence.papers = results["openalex"]
    evidence.trials = results["clinicaltrials"]
    evidence.faculty_leads = results["nih_reporter"]
    evidence.filing_mentions = results["sec_edgar"]

    return PartnershipResult(
        company=company,
        institution=institution,
        evidence=evidence,
        signals=detect_signals(company.name, institution.name, evidence),
        statuses=statuses,
        elapsed_seconds=round(time.monotonic() - started, 2))
