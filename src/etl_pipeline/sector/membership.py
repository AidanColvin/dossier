"""sector membership: turn a typed sector into a concrete company set.

three paths are tried in order and the result is never empty: curated seeds,
live edgar full-text discovery, then a default blue-chip set. the method that
produced the set is recorded so the report can say where its companies came
from.
"""
from dataclasses import dataclass, field
from typing import Optional

from etl_pipeline.config import Config
from etl_pipeline.http_client import Fetcher
from etl_pipeline.sector.discover import discover_companies
from etl_pipeline.sector.seeds import DEFAULT_SEEDS, canonical_sector, curated_seeds

MAX_COMPANIES = 8

METHOD_CURATED = "curated"
METHOD_DISCOVERED = "discovered"
METHOD_DEFAULT = "default"


@dataclass(frozen=True)
class SectorCompany:
    """one company selected for a sector scan.

    name and cik are filled by discovery when it found them; a curated seed
    carries only its ticker and resolves fully inside the pipeline.
    """

    ticker: str
    name: str = ""
    cik: str = ""


@dataclass
class SectorResolution:
    """the outcome of resolving a sector to companies.

    method records which path produced the set: curated, discovered, or
    default.
    """

    sector: str
    query: str
    method: str
    companies: list[SectorCompany] = field(default_factory=list)


def resolve_sector(text: str, http: Fetcher, config: Optional[Config] = None,
                   limit: int = MAX_COMPANIES) -> SectorResolution:
    """
    given free sector text and a fetcher
    return a SectorResolution whose company list is never empty

    curated seeds win because they are instant and hand-checked. discovery
    covers everything else edgar knows about. the default set is the floor,
    so a nonsense query still produces a working, clearly-labeled report.
    """
    config = config or Config()
    sector = canonical_sector(text)

    tickers = curated_seeds(sector)[:limit]
    if tickers:
        return SectorResolution(
            sector=sector, query=text.strip(), method=METHOD_CURATED,
            companies=[SectorCompany(ticker=t) for t in tickers])

    discovered = discover_companies(sector, http, config, limit)
    if discovered:
        return SectorResolution(
            sector=sector, query=text.strip(), method=METHOD_DISCOVERED,
            companies=[SectorCompany(ticker=c["ticker"], name=c["name"],
                                     cik=c["cik"]) for c in discovered])

    return SectorResolution(
        sector=sector, query=text.strip(), method=METHOD_DEFAULT,
        companies=[SectorCompany(ticker=t) for t in DEFAULT_SEEDS[:limit]])
