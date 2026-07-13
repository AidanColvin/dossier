"""tests for configuration loading."""
from etl_pipeline.config import DEFAULTS, Config, load_config


def test_load_config_returns_defaults():
    config = load_config()
    assert config.max_results_per_source == DEFAULTS["max_results_per_source"]
    assert config.min_sources_to_verify == DEFAULTS["min_sources_to_verify"]


def test_config_is_overridable():
    config = Config(max_results_per_source=3, min_sources_to_verify=2)
    assert config.max_results_per_source == 3
    assert config.min_sources_to_verify == 2


def test_user_agent_is_descriptive():
    assert "multi-source-etl-pipeline" in load_config().user_agent
