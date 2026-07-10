"""csv writer — one flat table of records."""
import csv
from pathlib import Path

from etl_pipeline.load.rows import COLUMNS, record_to_row
from etl_pipeline.models import Record


def write_csv(records: list[Record], path: Path) -> str:
    """
    given records and a target path
    write them as a csv table with a header row and return the path written
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(COLUMNS))
        writer.writeheader()
        for record in records:
            writer.writerow(record_to_row(record))
    return str(path)
