"""data models shared across the pipeline.

a Record is the single normalized shape every source maps onto, so the
transform and load stages never need to know which connector produced a row.
"""
from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass(frozen=True)
class Query:
    """one request for the pipeline to run.

    holds the entity to search for and the optional ticker used by the
    sec edgar connector to resolve a company.
    """
    entity: str
    ticker: str = ""
    max_results: int = 10


@dataclass
class Record:
    """one normalized row of data from any source.

    every connector maps its native payload onto these fields so downstream
    stages treat all sources identically.
    """
    source: str                                      # connector name
    record_type: str                                 # filing | paper | trial | grant
    native_id: str                                   # source-native identifier
    title: str
    url: str
    date: str                                        # iso date string, or ""
    entity: str                                      # query entity this row belongs to
    sources: list[str] = field(default_factory=list)   # provenance urls
    verified: bool = False
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class SourceResult:
    """outcome of running one connector.

    records is what the connector produced; ok and error report whether the
    fetch succeeded so one failing source never aborts the whole run.
    """
    source: str
    records: list[Record] = field(default_factory=list)
    ok: bool = True
    error: str = ""


@dataclass
class RunResult:
    """summary of a completed pipeline run.

    holds the final records, the per-source outcomes, and the paths written
    by the load stage.
    """
    entity: str
    records: list[Record] = field(default_factory=list)
    results: list[SourceResult] = field(default_factory=list)
    outputs: dict[str, str] = field(default_factory=dict)


def record_to_dict(record: Record) -> dict[str, Any]:
    """
    given a record
    return a plain dict copy suitable for json serialization
    """
    return asdict(record)


def record_from_dict(data: dict[str, Any]) -> Record:
    """
    given a plain dict of record fields
    return a Record, filling defaults for any missing optional fields
    """
    return Record(
        source=data["source"],
        record_type=data["record_type"],
        native_id=data["native_id"],
        title=data["title"],
        url=data["url"],
        date=data.get("date", ""),
        entity=data["entity"],
        sources=list(data.get("sources", [])),
        verified=bool(data.get("verified", False)),
        extra=dict(data.get("extra", {})),
    )
