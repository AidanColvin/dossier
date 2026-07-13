"""tests for cross-source deduplication."""
from etl_pipeline.models import Record
from etl_pipeline.transform.dedup import (dedup_key, dedup_records,
                                          merge_records, union_sources)


def rec(source, title, native_id="", sources=(), verified=False):
    return Record(source=source, record_type="paper", native_id=native_id,
                  title=title, url="u", date="", entity="e",
                  sources=list(sources), verified=verified)


def test_dedup_key_uses_title_when_present():
    assert dedup_key(rec("a", "Deep Learning")) == "paper|title|deep-learning"


def test_dedup_key_falls_back_to_id():
    assert dedup_key(rec("a", "", native_id="X1")) == "paper|id|x1"


def test_union_sources_dedupes_and_keeps_order():
    assert union_sources(["a", "b"], ["b", "c"]) == ["a", "b", "c"]


def test_merge_records_unions_provenance_and_verified():
    kept = rec("openalex", "Study", sources=["a"], verified=False)
    other = rec("sec_edgar", "Study", sources=["b"], verified=True)
    merged = merge_records(kept, other)
    assert merged.sources == ["a", "b"]
    assert merged.verified is True
    assert merged.extra["also_sources"] == ["sec_edgar"]


def test_dedup_records_merges_matching_titles():
    records = [rec("openalex", "Same Title", sources=["a"]),
               rec("nih_reporter", "Same Title", sources=["b"])]
    deduped = dedup_records(records)
    assert len(deduped) == 1
    assert deduped[0].sources == ["a", "b"]


def test_merge_same_source_records_omits_also_sources():
    kept = rec("openalex", "Study", sources=["a"])
    other = rec("openalex", "Study", sources=["b"])
    merged = merge_records(kept, other)
    assert "also_sources" not in merged.extra


def test_dedup_records_keeps_distinct():
    records = [rec("a", "One"), rec("a", "Two")]
    assert len(dedup_records(records)) == 2


def test_dedup_records_preserves_first_seen_order():
    records = [rec("a", "Beta"), rec("a", "Alpha"), rec("a", "Beta")]
    titles = [r.title for r in dedup_records(records)]
    assert titles == ["Beta", "Alpha"]
