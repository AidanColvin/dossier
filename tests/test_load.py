"""tests for the load stage and its writers."""
import json
import sqlite3

from etl_pipeline.core.load import ALL_FORMATS, load, output_base
from etl_pipeline.load.csv_loader import write_csv
from etl_pipeline.load.json_loader import to_serializable, write_json
from etl_pipeline.load.rows import record_to_row
from etl_pipeline.load.sqlite_loader import write_sqlite


def test_output_base_slugifies():
    assert output_base("NVIDIA Corp") == "nvidia-corp"


def test_output_base_defaults_when_blank():
    assert output_base("") == "records"


def test_record_to_row_serializes_collections(sample_records):
    row = record_to_row(sample_records[1])
    assert row["verified"] == 0
    assert " | " in row["sources"]
    assert json.loads(row["extra"]) == {}


def test_write_json_round_trips(tmp_path, sample_records):
    path = write_json(sample_records, tmp_path / "out.json")
    data = json.loads((tmp_path / "out.json").read_text())
    assert len(data) == 2
    assert data[0]["source"] == "openalex"
    assert path.endswith("out.json")


def test_to_serializable_is_plain_dicts(sample_records):
    assert all(isinstance(d, dict) for d in to_serializable(sample_records))


def test_write_csv_has_header_and_rows(tmp_path, sample_records):
    write_csv(sample_records, tmp_path / "out.csv")
    lines = (tmp_path / "out.csv").read_text().strip().splitlines()
    assert lines[0].startswith("source,record_type")
    assert len(lines) == 3  # header + 2 records


def test_write_sqlite_inserts_rows(tmp_path, sample_records):
    path = write_sqlite(sample_records, tmp_path / "out.sqlite")
    connection = sqlite3.connect(path)
    try:
        count = connection.execute("SELECT COUNT(*) FROM records").fetchone()[0]
        titles = [r[0] for r in connection.execute("SELECT title FROM records")]
    finally:
        connection.close()
    assert count == 2
    assert "A paper" in titles


def test_write_sqlite_rebuilds_table(tmp_path, sample_records):
    write_sqlite(sample_records, tmp_path / "out.sqlite")
    write_sqlite(sample_records[:1], tmp_path / "out.sqlite")  # overwrite, not append
    connection = sqlite3.connect(str(tmp_path / "out.sqlite"))
    try:
        count = connection.execute("SELECT COUNT(*) FROM records").fetchone()[0]
    finally:
        connection.close()
    assert count == 1


def test_load_writes_all_formats(tmp_path, sample_records):
    outputs = load(sample_records, str(tmp_path), "NVIDIA", list(ALL_FORMATS))
    assert set(outputs) == {"json", "csv", "sqlite"}
    for path in outputs.values():
        assert path.endswith(("json", "csv", "sqlite"))


def test_load_writes_selected_format_only(tmp_path, sample_records):
    outputs = load(sample_records, str(tmp_path), "NVIDIA", ["json"])
    assert list(outputs) == ["json"]
