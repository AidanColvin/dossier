"""tests for the command-line interface."""
from etl_pipeline import cli
from etl_pipeline.models import RunResult, SourceResult


def test_split_list_parses_items():
    assert cli.split_list("a, b ,c") == ["a", "b", "c"]


def test_split_list_empty_is_none():
    assert cli.split_list("") is None


def test_config_from_args_carries_limits():
    args = cli.build_parser().parse_args(["--entity", "X", "--max-results", "3",
                                          "--min-sources", "2"])
    config = cli.config_from_args(args)
    assert config.max_results_per_source == 3
    assert config.min_sources_to_verify == 2


def test_query_from_args_reads_entity_and_ticker():
    args = cli.build_parser().parse_args(["--entity", "NVIDIA", "--ticker", "NVDA"])
    query = cli.query_from_args(args)
    assert query.entity == "NVIDIA"
    assert query.ticker == "NVDA"


def test_summarize_reports_counts_and_paths():
    result = RunResult(entity="NVIDIA",
                       results=[SourceResult(source="openalex", ok=True),
                                SourceResult(source="sec_edgar", ok=False, error="boom")],
                       outputs={"json": "out/nvidia.json"})
    text = cli.summarize(result)
    assert "entity: NVIDIA" in text
    assert "openalex: 0 records — ok" in text
    assert "sec_edgar: 0 records — failed (boom)" in text
    assert "wrote json: out/nvidia.json" in text


def test_main_runs_offline(monkeypatch, tmp_path, fake_http, capsys):
    monkeypatch.setattr(cli, "run",
                        lambda *a, **k: __run_offline(fake_http, tmp_path, *a, **k))
    code = cli.main(["--entity", "NVIDIA", "--ticker", "NVDA",
                     "--out", str(tmp_path), "--formats", "json"])
    assert code == 0
    assert "entity: NVIDIA" in capsys.readouterr().out


def __run_offline(fake_http, tmp_path, query, **kwargs):
    """helper: force the real pipeline to use the offline fetcher."""
    from etl_pipeline.core.pipeline import run as real_run
    kwargs["http"] = fake_http
    return real_run(query, **kwargs)
