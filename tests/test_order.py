"""tests for record ordering."""
from etl_pipeline.models import Record
from etl_pipeline.transform.order import sort_records


def rec(date, source="s", title="t"):
    return Record(source=source, record_type="paper", native_id="1", title=title,
                  url="u", date=date, entity="e")


def test_sort_records_newest_first():
    records = [rec("2022-01-01"), rec("2024-05-01"), rec("2023-03-01")]
    dates = [r.date for r in sort_records(records)]
    assert dates == ["2024-05-01", "2023-03-01", "2022-01-01"]


def test_sort_records_year_only_sorts_sensibly():
    records = [rec("2021"), rec("2024"), rec("2023")]
    dates = [r.date for r in sort_records(records)]
    assert dates == ["2024", "2023", "2021"]


def test_sort_records_is_deterministic_on_ties():
    records = [rec("2024-01-01", source="b", title="z"),
               rec("2024-01-01", source="a", title="y")]
    ordered = sort_records(records)
    assert [r.source for r in ordered] == ["a", "b"]


def test_sort_records_blank_dates_sort_last():
    records = [rec(""), rec("2024-01-01")]
    dates = [r.date for r in sort_records(records)]
    assert dates == ["2024-01-01", ""]
