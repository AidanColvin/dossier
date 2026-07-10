"""flat row projection shared by the csv and sqlite writers.

both need records as flat, primitive-valued rows, so the column list and the
record-to-row mapping live here in one place.
"""
import json

from etl_pipeline.models import Record
from etl_pipeline.text import as_text

COLUMNS = (
    "source", "record_type", "native_id", "title", "url",
    "date", "entity", "verified", "source_count", "sources", "extra",
)


def join_sources(sources: list[str]) -> str:
    """
    given a list of source urls
    return them joined into a single ' | '-delimited string
    """
    return " | ".join(sources or [])


def record_to_row(record: Record) -> dict[str, object]:
    """
    given a record
    return a flat dict keyed by COLUMNS, with lists and dicts serialized
    """
    return {
        "source": record.source,
        "record_type": record.record_type,
        "native_id": record.native_id,
        "title": record.title,
        "url": record.url,
        "date": record.date,
        "entity": record.entity,
        "verified": int(record.verified),
        "source_count": int(record.extra.get("source_count", len(record.sources))),
        "sources": join_sources(record.sources),
        "extra": json.dumps(record.extra, sort_keys=True),
    }
