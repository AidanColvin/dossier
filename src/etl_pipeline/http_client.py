"""minimal json-over-http client built on the standard library.

connectors never import urllib directly. they receive a fetcher callable
(see build_fetcher) so tests can inject a fake and run fully offline.
"""
import json
import time
from typing import Any, Callable, Optional
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import URLError

from etl_pipeline.config import Config
from etl_pipeline.net_guard import assert_public_url

# a fetcher takes (method, url) plus optional params/body/headers and returns
# the decoded json object. this is the single seam connectors depend on.
Fetcher = Callable[..., Any]


class HttpError(RuntimeError):
    """raised when a request fails after exhausting all retries."""


def build_url(url: str, params: Optional[dict]) -> str:
    """
    given a base url and an optional params dict
    return the url with an encoded query string appended
    """
    if not params:
        return url
    return f"{url}?{urlencode(params, doseq=True)}"


def encode_body(body: Optional[dict]) -> Optional[bytes]:
    """
    given an optional json body dict
    return it encoded as utf-8 bytes, or None when there is no body
    """
    if body is None:
        return None
    return json.dumps(body).encode("utf-8")


def build_request(method: str, url: str, body: Optional[dict],
                  headers: dict) -> Request:
    """
    given a method, url, optional body, and headers
    return a urllib Request ready to be opened
    """
    payload = encode_body(body)
    request = Request(url, data=payload, method=method.upper())
    for name, value in headers.items():
        request.add_header(name, value)
    if payload is not None:
        request.add_header("Content-Type", "application/json")
    return request


def read_response(request: Request, timeout: int) -> bytes:
    """
    given a prepared request and a timeout
    return the raw response bytes from a single call
    """
    with urlopen(request, timeout=timeout) as response:
        return response.read()


def parse_json(raw: bytes) -> Any:
    """
    given raw response bytes
    return the decoded json object, or {} when the body is empty
    """
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def _default_headers(config: Config) -> dict:
    """
    given a config
    return the baseline request headers, including the user agent
    """
    return {"User-Agent": config.user_agent, "Accept": "application/json"}


def request_json(method: str, url: str, config: Config,
                 params: Optional[dict] = None, body: Optional[dict] = None,
                 headers: Optional[dict] = None, guard: bool = True) -> Any:
    """
    given a method, url, and config
    return the decoded json, retrying transient failures with backoff
    raise HttpError once all retries are exhausted
    """
    full_url = build_url(url, params)
    if guard:
        assert_public_url(full_url)
    merged = {**_default_headers(config), **(headers or {})}
    request = build_request(method, full_url, body, merged)

    last_error: Optional[Exception] = None
    for attempt in range(1, config.http_max_retries + 1):
        try:
            raw = read_response(request, config.http_timeout_seconds)
            return parse_json(raw)
        except (URLError, TimeoutError, OSError, ValueError) as exc:
            last_error = exc
            if attempt < config.http_max_retries:
                time.sleep(config.http_backoff_seconds * attempt)
    raise HttpError(f"request failed after {config.http_max_retries} tries: {last_error}")


def build_fetcher(config: Config, guard: bool = True) -> Fetcher:
    """
    given a config
    return a fetcher callable that binds the config to request_json
    """
    def fetch_json(method: str, url: str, params: Optional[dict] = None,
                   body: Optional[dict] = None,
                   headers: Optional[dict] = None) -> Any:
        return request_json(method, url, config, params=params, body=body,
                            headers=headers, guard=guard)

    return fetch_json
