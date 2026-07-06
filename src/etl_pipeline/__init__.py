"""multi-source-etl-pipeline.

a modular, keyless etl pipeline that extracts public research and company
data from several primary sources, normalizes it to a single record shape,
validates provenance, and loads it to json, csv, and sqlite.
"""
from etl_pipeline.models import Query, Record, SourceResult, RunResult
from etl_pipeline.config import Config, load_config

__version__ = "0.1.0"

__all__ = [
    "Query",
    "Record",
    "SourceResult",
    "RunResult",
    "Config",
    "load_config",
    "__version__",
]
