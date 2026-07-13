"""tests for the json-over-http client."""
import pytest

from etl_pipeline import http_client
from etl_pipeline.config import Config
from etl_pipeline.http_client import (HttpError, build_fetcher, build_request,
                                      build_url, encode_body, parse_json,
                                      request_json)


def test_build_url_without_params_is_unchanged():
    assert build_url("https://x.test", None) == "https://x.test"


def test_build_url_encodes_params():
    url = build_url("https://x.test", {"q": "a b", "n": 2})
    assert url == "https://x.test?q=a+b&n=2"


def test_encode_body_none_is_none():
    assert encode_body(None) is None


def test_encode_body_serializes_dict():
    assert encode_body({"a": 1}) == b'{"a": 1}'


def test_build_request_sets_method_and_headers():
    request = build_request("post", "https://x.test", {"a": 1}, {"User-Agent": "t"})
    assert request.get_method() == "POST"
    assert request.get_header("User-agent") == "t"
    assert request.get_header("Content-type") == "application/json"


def test_parse_json_empty_bytes_is_empty_dict():
    assert parse_json(b"") == {}


def test_parse_json_decodes_object():
    assert parse_json(b'{"a": 1}') == {"a": 1}


def test_request_json_returns_parsed(monkeypatch):
    monkeypatch.setattr(http_client, "assert_public_url", lambda url: None)
    monkeypatch.setattr(http_client, "read_response", lambda req, timeout: b'{"ok": true}')
    result = request_json("GET", "https://x.test", Config())
    assert result == {"ok": True}


def test_request_json_retries_then_raises(monkeypatch):
    monkeypatch.setattr(http_client, "assert_public_url", lambda url: None)
    monkeypatch.setattr(http_client.time, "sleep", lambda seconds: None)

    def always_fail(req, timeout):
        raise OSError("boom")

    monkeypatch.setattr(http_client, "read_response", always_fail)
    with pytest.raises(HttpError):
        request_json("GET", "https://x.test", Config(http_max_retries=2))


def test_build_fetcher_binds_config(monkeypatch):
    monkeypatch.setattr(http_client, "assert_public_url", lambda url: None)
    monkeypatch.setattr(http_client, "read_response", lambda req, timeout: b'{"v": 1}')
    fetch = build_fetcher(Config())
    assert fetch("GET", "https://x.test", params={"a": "b"}) == {"v": 1}
