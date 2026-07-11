"""load stage: dispatch records to the selected output writers."""
from pathlib import Path

from etl_pipeline.load.csv_loader import write_csv
from etl_pipeline.load.json_loader import write_json
from etl_pipeline.load.sqlite_loader import write_sqlite
from etl_pipeline.models import Record
from etl_pipeline.text import slugify

# format name -> (file extension, writer function)
WRITERS = {
    "json": ("json", write_json),
    "csv": ("csv", write_csv),
    "sqlite": ("sqlite", write_sqlite),
}
ALL_FORMATS = tuple(WRITERS)


def output_base(entity: str) -> str:
    """
    given an entity name
    return a filesystem-safe base filename for its outputs
    """
    return slugify(entity) or "records"


def target_path(out_dir: str, base: str, extension: str) -> Path:
    """
    given an output directory, a base name, and an extension
    return the full path for that output file
    """
    return Path(out_dir) / f"{base}.{extension}"


def write_format(records: list[Record], out_dir: str, base: str,
                 fmt: str) -> str:
    """
    given records and a single format name
    write that format and return the path written
    raise KeyError when the format is unknown
    """
    extension, writer = WRITERS[fmt]
    return writer(records, target_path(out_dir, base, extension))


def load(records: list[Record], out_dir: str, entity: str,
         formats: list[str]) -> dict[str, str]:
    """
    given records, an output directory, an entity, and target formats
    write each format and return a map of format name to written path
    """
    base = output_base(entity)
    return {fmt: write_format(records, out_dir, base, fmt) for fmt in formats}
