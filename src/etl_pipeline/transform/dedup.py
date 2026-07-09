"""deduplication of records across sources.

two records collide when they describe the same thing: the same record type
and either the same native id or the same normalized title. colliding records
are merged into one whose provenance is the union of both.
"""
from etl_pipeline.models import Record
from etl_pipeline.text import as_text, slugify


def dedup_key(record: Record) -> str:
    """
    given a record
    return a stable key that is equal for records describing the same thing
    """
    title_slug = slugify(record.title)
    if title_slug:
        return f"{record.record_type}|title|{title_slug}"
    return f"{record.record_type}|id|{as_text(record.native_id).lower()}"


def union_sources(first: list[str], second: list[str]) -> list[str]:
    """
    given two source lists
    return their union with order preserved and duplicates removed
    """
    merged: list[str] = []
    for url in list(first) + list(second):
        if url not in merged:
            merged.append(url)
    return merged


def merge_records(kept: Record, other: Record) -> Record:
    """
    given a kept record and a duplicate of it
    return the kept record enriched with the duplicate's provenance
    """
    kept.sources = union_sources(kept.sources, other.sources)
    kept.verified = kept.verified or other.verified
    if other.source != kept.source:
        also = kept.extra.setdefault("also_sources", [])
        if other.source not in also:
            also.append(other.source)
    return kept


def dedup_records(records: list[Record]) -> list[Record]:
    """
    given a list of records
    return one record per distinct key, merging provenance of duplicates
    """
    by_key: dict[str, Record] = {}
    order: list[str] = []
    for record in records:
        key = dedup_key(record)
        if key in by_key:
            merge_records(by_key[key], record)
        else:
            by_key[key] = record
            order.append(key)
    return [by_key[key] for key in order]
