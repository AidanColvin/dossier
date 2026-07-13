"""tests for the transform stage."""
from etl_pipeline.config import Config
from etl_pipeline.core.transform import gather_records, transform, verify_all
from etl_pipeline.models import Record, SourceResult


def rec(source, title, date, sources):
    return Record(source=source, record_type="paper", native_id=title,
                  title=title, url="u", date=date, entity="e", sources=list(sources))


def test_gather_records_flattens_in_order():
    results = [SourceResult(source="a", records=[rec("a", "x", "", [])]),
               SourceResult(source="b", records=[rec("b", "y", "", [])])]
    assert [r.title for r in gather_records(results)] == ["x", "y"]


def test_verify_all_sets_flags():
    records = verify_all([rec("a", "x", "", ["https://nih.gov/1"])], Config())
    assert records[0].verified is True


def test_transform_dedups_verifies_and_orders():
    results = [
        SourceResult(source="openalex", records=[
            rec("openalex", "Shared", "2024-01-01", ["https://openalex.org/1"])]),
        SourceResult(source="nih_reporter", records=[
            rec("nih_reporter", "Shared", "2024-01-01", ["https://reporter.nih.gov/2"]),
            rec("nih_reporter", "Older", "2020-01-01", ["https://reporter.nih.gov/3"])]),
    ]
    records = transform(results, Config())
    assert len(records) == 2  # the two "Shared" rows merge
    assert records[0].title == "Shared"
    assert len(records[0].sources) == 2  # provenance unioned across sources
    assert records[1].title == "Older"
