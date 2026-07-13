"""end-to-end tests for the run() orchestrator, fully offline."""
import json

from etl_pipeline.core.pipeline import collect, run
from etl_pipeline.models import Query


def test_run_produces_records_from_all_sources(query, fake_http, tmp_path):
    result = run(query, out_dir=str(tmp_path), http=fake_http)
    kinds = {r.record_type for r in result.records}
    assert kinds == {"filing", "paper", "trial", "grant"}


def test_run_writes_all_three_outputs(query, fake_http, tmp_path):
    result = run(query, out_dir=str(tmp_path), http=fake_http)
    assert set(result.outputs) == {"json", "csv", "sqlite"}
    for path in result.outputs.values():
        assert (tmp_path / path.split("/")[-1]).exists()


def test_run_json_output_is_valid(query, fake_http, tmp_path):
    result = run(query, out_dir=str(tmp_path), http=fake_http)
    data = json.loads(open(result.outputs["json"]).read())
    assert len(data) == len(result.records)


def test_run_subset_of_sources(query, fake_http, tmp_path):
    result = run(query, sources=["openalex"], out_dir=str(tmp_path), http=fake_http)
    assert {r.source for r in result.records} == {"openalex"}


def test_run_records_are_newest_first(query, fake_http, tmp_path):
    result = run(query, out_dir=str(tmp_path), http=fake_http)
    dates = [r.date for r in result.records if r.date]
    assert dates == sorted(dates, reverse=True)


def test_run_sequential_matches_concurrent(query, fake_http, tmp_path):
    a = run(query, out_dir=str(tmp_path / "a"), http=fake_http, concurrent=True)
    b = run(query, out_dir=str(tmp_path / "b"), http=fake_http, concurrent=False)
    assert len(a.records) == len(b.records)


def test_run_missing_ticker_skips_sec(fake_http, tmp_path):
    result = run(Query(entity="NVIDIA"), out_dir=str(tmp_path), http=fake_http)
    assert "filing" not in {r.record_type for r in result.records}


def test_collect_returns_records_without_writing(query, fake_http):
    result = collect(query, http=fake_http)
    assert result.outputs == {}
    assert len(result.records) > 0


def test_collect_and_run_agree_on_records(query, fake_http, tmp_path):
    collected = collect(query, http=fake_http)
    written = run(query, out_dir=str(tmp_path), http=fake_http)
    assert len(collected.records) == len(written.records)
