"""sector orchestrator: fan the single-company pipeline out across a sector.

the outer pool stays small on purpose. each collect() call already runs its
own four-connector inner pool, so 4 outer workers puts a ceiling of sixteen
concurrent requests across all sources, which stays polite to sec.gov. one
shared wall-clock budget bounds the whole fan-out, so a single slow company
can never stall the scan past the serverless deadline.
"""
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from dataclasses import dataclass, field
from typing import Callable, Optional

from etl_pipeline.config import Config
from etl_pipeline.core.pipeline import collect
from etl_pipeline.http_client import Fetcher, build_fetcher
from etl_pipeline.models import Query, RunResult
from etl_pipeline.sector.membership import (
    MAX_COMPANIES,
    SectorCompany,
    SectorResolution,
    resolve_sector,
)

SECTOR_WORKERS = 4
# two waves of four (eight companies, four workers) at the per-company
# deadline is 30s worst case; the extra margin covers report assembly and
# verification, which run after this budget, comfortably inside Vercel's
# 60s function ceiling.
TOTAL_BUDGET_SECONDS = 40.0
SOURCE_TIMEOUT_SECONDS = 15.0
SECTOR_MAX_RESULTS = 5

# an emitter receives (event kind, payload). the http layer turns these into
# server-sent events; the blocking route passes None and gets no events.
Emitter = Callable[[str, dict], None]


def sector_config() -> Config:
    """
    takes nothing
    return a Config with budgets tight enough for an 8-company fan-out

    the api defaults allow a worst case near a minute for one company. a
    sector scan multiplies that risk by the company count, so retries and
    timeouts are cut to keep the whole batch inside the serverless ceiling.
    """
    return Config(http_timeout_seconds=6, http_max_retries=2,
                  http_backoff_seconds=0.3,
                  max_results_per_source=SECTOR_MAX_RESULTS)


@dataclass
class CompanyOutcome:
    """what happened to one company during a sector scan.

    ok is False when the company's run failed or ran out of budget, in which
    case result is None and error says why. a failed company becomes a noted
    gap in the report, never an aborted scan.
    """

    company: SectorCompany
    result: Optional[RunResult] = None
    ok: bool = True
    error: str = ""


@dataclass
class SectorRun:
    """a completed sector fan-out, before report assembly.

    outcomes always match the resolution's company order, so reports are
    reproducible run to run.
    """

    resolution: SectorResolution
    outcomes: list[CompanyOutcome] = field(default_factory=list)
    elapsed_seconds: float = 0.0


def run_company(company: SectorCompany, http: Fetcher,
                config: Config) -> RunResult:
    """
    given one sector company and the run inputs
    return the full single-company pipeline result
    """
    query = Query(entity=company.name, ticker=company.ticker,
                  max_results=config.max_results_per_source)
    return collect(query, config=config, http=http,
                   source_timeout=SOURCE_TIMEOUT_SECONDS)


def _emit(emit: Optional[Emitter], kind: str, payload: dict) -> None:
    """
    given an optional emitter and one event
    deliver the event, swallowing emitter errors so a bad listener can
    never break a scan
    """
    if emit is None:
        return
    try:
        emit(kind, payload)
    except Exception:  # noqa: BLE001 - events are advisory, never fatal
        pass


def run_sector(text: str, http: Optional[Fetcher] = None,
               config: Optional[Config] = None,
               emit: Optional[Emitter] = None,
               limit: int = MAX_COMPANIES,
               budget_seconds: float = TOTAL_BUDGET_SECONDS) -> SectorRun:
    """
    given free sector text and options
    resolve the sector, run the pipeline for every company concurrently,
    and return a SectorRun in stable company order

    emits "resolved" once membership is known and one "progress" per company
    as it finishes. companies still running when the budget runs out become
    failed outcomes rather than holding the scan open.
    """
    config = config or sector_config()
    fetch_json = http or build_fetcher(config)
    started = time.monotonic()

    resolution = resolve_sector(text, fetch_json, config, limit=limit)
    _emit(emit, "resolved", {
        "sector": resolution.sector,
        "method": resolution.method,
        "total": len(resolution.companies),
        "tickers": [c.ticker for c in resolution.companies],
    })

    deadline = started + budget_seconds
    outcomes: dict[int, CompanyOutcome] = {}

    # the pool is shut down without waiting: a company still running at the
    # deadline has already been recorded as failed, and joining its thread
    # would hold the response open for exactly the time the budget exists
    # to bound.
    pool = ThreadPoolExecutor(max_workers=SECTOR_WORKERS)
    try:
        futures = {
            pool.submit(run_company, company, fetch_json, config): index
            for index, company in enumerate(resolution.companies)
        }
        pending = set(futures)
        done_count = 0
        while pending:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            finished, pending = wait(pending, timeout=remaining,
                                     return_when=FIRST_COMPLETED)
            for future in finished:
                index = futures[future]
                company = resolution.companies[index]
                try:
                    outcomes[index] = CompanyOutcome(company=company,
                                                     result=future.result())
                except Exception as exc:  # noqa: BLE001 - one company must not abort the scan
                    outcomes[index] = CompanyOutcome(company=company, ok=False,
                                                     error=str(exc))
                done_count += 1
                _emit(emit, "progress", {
                    "done": done_count,
                    "total": len(resolution.companies),
                    "ticker": company.ticker,
                    "ok": outcomes[index].ok,
                })
        for future in pending:
            index = futures[future]
            company = resolution.companies[index]
            outcomes[index] = CompanyOutcome(
                company=company, ok=False,
                error=f"company exceeded the {budget_seconds}s scan budget")
            done_count += 1
            _emit(emit, "progress", {
                "done": done_count,
                "total": len(resolution.companies),
                "ticker": company.ticker,
                "ok": False,
            })
    finally:
        pool.shutdown(wait=False, cancel_futures=True)

    ordered = [outcomes[index] for index in range(len(resolution.companies))]
    return SectorRun(resolution=resolution, outcomes=ordered,
                     elapsed_seconds=round(time.monotonic() - started, 2))
