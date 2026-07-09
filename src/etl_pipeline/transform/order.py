"""ordering of records for output.

records are sorted newest first by date, with source and title breaking ties
so the ordering is deterministic across runs.
"""
from etl_pipeline.models import Record
from etl_pipeline.text import as_text


def sort_key(record: Record) -> tuple[str, str, str]:
    """
    given a record
    return a sort key of (negated date, source, title) for newest-first order
    """
    # dates are iso strings; padding keeps short values like a bare year sorting
    # sensibly, and the leading swap makes a plain ascending sort newest-first.
    date = as_text(record.date).ljust(10, "0")
    inverted = "".join(chr(255 - ord(ch)) for ch in date)
    return (inverted, record.source, as_text(record.title).lower())


def sort_records(records: list[Record]) -> list[Record]:
    """
    given a list of records
    return them ordered newest first by date, then source, then title
    """
    return sorted(records, key=sort_key)
