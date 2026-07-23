"""tests for the sector orchestrator, driven entirely offline."""
from etl_pipeline.sector import orchestrator
from etl_pipeline.sector.orchestrator import run_sector, sector_config


def collect_events():
    """
    takes nothing
    return (emit, events) where emit appends each event to events
    """
    events: list[tuple[str, dict]] = []

    def emit(kind: str, payload: dict) -> None:
        events.append((kind, payload))

    return emit, events


def test_run_sector_profiles_every_company(fake_http):
    run = run_sector("semiconductors", http=fake_http, limit=2)
    assert run.resolution.method == "curated"
    assert len(run.outcomes) == 2
    assert all(o.ok for o in run.outcomes)
    assert all(o.result is not None for o in run.outcomes)
    # nvda exists in the tickers fixture and must resolve fully.
    assert run.outcomes[0].result.resolved is True


def test_run_sector_emits_resolved_then_progress(fake_http):
    emit, events = collect_events()
    run_sector("semiconductors", http=fake_http, limit=2, emit=emit)
    kinds = [kind for kind, _ in events]
    assert kinds[0] == "resolved"
    assert kinds.count("progress") == 2
    resolved = events[0][1]
    assert resolved["total"] == 2
    assert resolved["tickers"] == ["NVDA", "AMD"]
    last_progress = [p for k, p in events if k == "progress"][-1]
    assert last_progress["done"] == 2


def test_one_failing_company_does_not_abort(fake_http, monkeypatch):
    real = orchestrator.run_company

    def flaky(company, http, config):
        if company.ticker == "AMD":
            raise RuntimeError("amd exploded")
        return real(company, http, config)

    monkeypatch.setattr(orchestrator, "run_company", flaky)
    run = run_sector("semiconductors", http=fake_http, limit=2)
    by_ticker = {o.company.ticker: o for o in run.outcomes}
    assert by_ticker["NVDA"].ok is True
    assert by_ticker["AMD"].ok is False
    assert "amd exploded" in by_ticker["AMD"].error


def test_budget_expiry_marks_stragglers_failed(fake_http, monkeypatch):
    import time as time_module

    def stuck(company, http, config):
        time_module.sleep(0.5)
        raise AssertionError("should never be reached inside the budget")

    monkeypatch.setattr(orchestrator, "run_company", stuck)
    run = run_sector("semiconductors", http=fake_http, limit=2,
                     budget_seconds=0.05)
    assert all(o.ok is False for o in run.outcomes)
    assert all("budget" in o.error for o in run.outcomes)


def test_outcomes_keep_company_order(fake_http):
    run = run_sector("semiconductors", http=fake_http, limit=4)
    tickers = [o.company.ticker for o in run.outcomes]
    assert tickers == ["NVDA", "AMD", "INTC", "AVGO"]


def test_sector_config_is_tighter_than_defaults():
    config = sector_config()
    assert config.http_timeout_seconds < 10
    assert config.http_max_retries < 3
    assert config.max_results_per_source <= 5
