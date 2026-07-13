"""tests for the data models."""
from etl_pipeline.models import Query, Record, RunResult, SourceResult, record_to_dict


def test_query_defaults():
    query = Query(entity="NVIDIA")
    assert query.ticker == ""
    assert query.max_results == 10


def test_record_defaults_are_independent():
    a = Record(source="s", record_type="t", native_id="1", title="x",
               url="u", date="", entity="e")
    b = Record(source="s", record_type="t", native_id="2", title="y",
               url="u", date="", entity="e")
    a.sources.append("z")
    assert b.sources == []


def test_record_to_dict_round_trips_fields():
    record = Record(source="s", record_type="t", native_id="1", title="x",
                    url="u", date="2024", entity="e", sources=["a"],
                    verified=True, extra={"k": "v"})
    as_dict = record_to_dict(record)
    assert as_dict["sources"] == ["a"]
    assert as_dict["verified"] is True
    assert as_dict["extra"] == {"k": "v"}


def test_source_result_defaults_ok():
    result = SourceResult(source="s")
    assert result.ok is True
    assert result.records == []


def test_run_result_holds_outputs():
    run = RunResult(entity="e", outputs={"json": "x.json"})
    assert run.outputs["json"] == "x.json"
