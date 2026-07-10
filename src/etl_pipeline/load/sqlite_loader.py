"""sqlite writer — a single `records` table, rebuilt on each run."""
import sqlite3
from pathlib import Path

from etl_pipeline.load.rows import COLUMNS, record_to_row
from etl_pipeline.models import Record

_CREATE = (
    "CREATE TABLE records ("
    "source TEXT, record_type TEXT, native_id TEXT, title TEXT, url TEXT, "
    "date TEXT, entity TEXT, verified INTEGER, source_count INTEGER, "
    "sources TEXT, extra TEXT)"
)
_INSERT = (
    "INSERT INTO records (" + ", ".join(COLUMNS) + ") VALUES ("
    + ", ".join("?" for _ in COLUMNS) + ")"
)


def row_values(record: Record) -> tuple:
    """
    given a record
    return its column values in COLUMNS order for a parameterized insert
    """
    row = record_to_row(record)
    return tuple(row[column] for column in COLUMNS)


def write_sqlite(records: list[Record], path: Path) -> str:
    """
    given records and a target path
    write them into a fresh `records` table and return the path written
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        path.unlink()
    connection = sqlite3.connect(str(path))
    try:
        connection.execute(_CREATE)
        connection.executemany(_INSERT, [row_values(record) for record in records])
        connection.commit()
    finally:
        connection.close()
    return str(path)
