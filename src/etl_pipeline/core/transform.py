"""transform stage: flatten, deduplicate, verify, and order records."""
from etl_pipeline.config import Config
from etl_pipeline.models import Record, SourceResult
from etl_pipeline.transform.dedup import dedup_records
from etl_pipeline.transform.order import sort_records
from etl_pipeline.transform.validate import verify_record


def gather_records(results: list[SourceResult]) -> list[Record]:
    """
    given the per-source results
    return every record flattened into one list, in source order
    """
    records: list[Record] = []
    for result in results:
        records.extend(result.records)
    return records


def verify_all(records: list[Record], config: Config) -> list[Record]:
    """
    given records and a config
    return the same records with each one's provenance verified
    """
    return [verify_record(record, config) for record in records]


def transform(results: list[SourceResult], config: Config) -> list[Record]:
    """
    given the per-source results and a config
    return deduplicated, verified, newest-first records
    """
    records = gather_records(results)
    deduped = dedup_records(records)
    verified = verify_all(deduped, config)
    return sort_records(verified)
