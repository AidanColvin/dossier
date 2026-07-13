"""tests for provenance validation."""
from etl_pipeline.config import Config
from etl_pipeline.models import Record
from etl_pipeline.transform.validate import (distinct_reputable, is_reputable,
                                             normalize_url, verify_record)


def make_record(sources):
    return Record(source="s", record_type="t", native_id="1", title="x",
                  url="u", date="", entity="e", sources=list(sources))


def test_normalize_url_rejects_non_http():
    assert normalize_url("javascript:alert(1)") is None


def test_normalize_url_rejects_none():
    assert normalize_url(None) is None


def test_normalize_url_rejects_non_string():
    assert normalize_url(1234) is None  # .strip() would raise, handled gracefully


def test_normalize_url_rejects_missing_host():
    assert normalize_url("https://") is None


def test_is_reputable_unknown_host_is_false():
    assert is_reputable("example.com") is False


def test_normalize_url_rejects_bare_host():
    assert normalize_url("sec.gov") is None


def test_normalize_url_canonicalizes():
    host, canonical = normalize_url("https://WWW.SEC.GOV/path/")
    assert host == "www.sec.gov"
    assert canonical == "https://www.sec.gov/path"


def test_is_reputable_allows_gov():
    assert is_reputable("data.sec.gov") is True


def test_is_reputable_allows_known_org():
    assert is_reputable("openalex.org") is True


def test_is_reputable_blocklist_wins():
    assert is_reputable("en.wikipedia.org") is False


def test_is_reputable_allows_company_domain():
    assert is_reputable("newsroom.acme.com", company_domains=("acme.com",)) is True


def test_distinct_reputable_dedupes_same_url():
    urls = ["https://www.sec.gov/a", "https://www.sec.gov/a/", "https://www.sec.gov/a"]
    assert distinct_reputable(urls) == ["https://www.sec.gov/a"]


def test_distinct_reputable_drops_untrusted():
    urls = ["https://crunchbase.com/x", "https://reporter.nih.gov/y"]
    assert distinct_reputable(urls) == ["https://reporter.nih.gov/y"]


def test_verify_record_marks_verified_at_one_source():
    record = verify_record(make_record(["https://www.sec.gov/a"]), Config())
    assert record.verified is True
    assert record.extra["source_count"] == 1


def test_verify_record_unverified_when_below_threshold():
    record = verify_record(make_record(["https://www.sec.gov/a"]),
                           Config(min_sources_to_verify=2))
    assert record.verified is False


def test_verify_record_strips_untrusted_sources():
    record = verify_record(make_record(["https://linkedin.com/x", "https://nih.gov/y"]),
                           Config())
    assert record.sources == ["https://nih.gov/y"]
