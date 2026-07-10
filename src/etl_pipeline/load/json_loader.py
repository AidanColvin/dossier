"""json writer — one file holding the full records list."""
import json
from pathlib import Path

from etl_pipeline.models import Record, record_to_dict


def to_serializable(records: list[Record]) -> list[dict]:
    """
    given a list of records
    return them as a list of plain json-serializable dicts
    """
    return [record_to_dict(record) for record in records]


def write_json(records: list[Record], path: Path) -> str:
    """
    given records and a target path
    write them as pretty-printed json and return the path written
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(to_serializable(records), indent=2, sort_keys=False)
    path.write_text(text, encoding="utf-8")
    return str(path)
