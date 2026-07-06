"""pipeline configuration.

all defaults live in one place so a run can be fully described by a single
Config object, mirroring how the pipeline actually behaves.
"""
from dataclasses import dataclass


DEFAULTS = {
    "max_results_per_source": 10,
    "http_timeout_seconds": 10,
    "http_max_retries": 3,
    "http_backoff_seconds": 0.5,
    "user_agent": "multi-source-etl-pipeline/0.1 (research; contact@example.com)",
    "min_sources_to_verify": 1,
}


@dataclass
class Config:
    """canonical settings for one pipeline run."""

    max_results_per_source: int = DEFAULTS["max_results_per_source"]
    http_timeout_seconds: int = DEFAULTS["http_timeout_seconds"]
    http_max_retries: int = DEFAULTS["http_max_retries"]
    http_backoff_seconds: float = DEFAULTS["http_backoff_seconds"]
    user_agent: str = DEFAULTS["user_agent"]
    min_sources_to_verify: int = DEFAULTS["min_sources_to_verify"]


def load_config() -> Config:
    """
    takes nothing
    return a Config built from the module defaults
    """
    return Config()
