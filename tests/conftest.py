"""shared test fixtures.

everything here keeps the suite fully offline: real api payloads are stored
as json fixtures and served by a fake fetcher, so no test touches the network.
"""
import json
from pathlib import Path

import pytest

from etl_pipeline.config import Config
from etl_pipeline.models import Query, Record

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    """
    given a fixture file name
    return its parsed json contents
    """
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.fixture
def config() -> Config:
    """a default config with the verification bar at one source."""
    return Config()


@pytest.fixture
def query() -> Query:
    """a query for a company with a ticker."""
    return Query(entity="NVIDIA", ticker="NVDA", max_results=10)


@pytest.fixture
def fake_http():
    """
    a fetcher that routes each url to the matching fixture payload,
    recording every call it receives for assertions.
    """
    routes = {
        "company_tickers": load_fixture("sec_company_tickers.json"),
        "submissions": load_fixture("sec_submissions.json"),
        "openalex": load_fixture("openalex_works.json"),
        "clinicaltrials": load_fixture("clinicaltrials_studies.json"),
        "reporter.nih": load_fixture("nih_projects.json"),
        "efts.sec.gov": load_fixture("efts_search.json"),
    }
    calls: list[dict] = []

    def fetch(method, url, params=None, body=None, headers=None):
        calls.append({"method": method, "url": url, "params": params, "body": body})
        for needle, payload in routes.items():
            if needle in url:
                return payload
        return {}

    fetch.calls = calls
    return fetch


@pytest.fixture
def sample_records() -> list[Record]:
    """a small hand-built record set for transform and load tests."""
    return [
        Record(source="openalex", record_type="paper", native_id="W1",
               title="A paper", url="https://openalex.org/W1", date="2024-03-01",
               entity="NVIDIA", sources=["https://openalex.org/W1"]),
        Record(source="sec_edgar", record_type="filing", native_id="acc-1",
               title="10-K filed 2024-02-21", url="https://www.sec.gov/x",
               date="2024-02-21", entity="NVIDIA",
               sources=["https://www.sec.gov/x", "https://www.sec.gov"]),
    ]
