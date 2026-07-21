"""request and response models for the http api."""
from typing import Any, Optional

from pydantic import BaseModel, Field


class RunRequest(BaseModel):
    """the body of a POST /run request."""

    entity: str = Field(..., description="company or organization to search for")
    ticker: str = Field("", description="stock ticker, used by the sec source")
    sources: Optional[list[str]] = Field(None, description="subset of sources; null means all")
    max_results: int = Field(10, ge=1, le=50, description="records to request per source")
    min_sources: int = Field(1, ge=1, le=5, description="reputable sources needed to verify")


class RecordModel(BaseModel):
    """one normalized record, as returned to the client."""

    source: str
    record_type: str
    native_id: str
    title: str
    url: str
    date: str
    entity: str
    sources: list[str]
    verified: bool
    extra: dict[str, Any]


class SourceStatus(BaseModel):
    """the outcome of one source during a run."""

    source: str
    ok: bool
    error: str
    count: int


class FilingModel(BaseModel):
    """one recent sec filing shown in a profile."""

    form: str
    filed: str
    accession: str
    url: str


class ProfileModel(BaseModel):
    """the company fact banner and financial history."""

    name: str = ""
    cik: str = ""
    ticker: str = ""
    exchange: str = ""
    industry: str = ""
    city: str = ""
    state: str = ""
    website: str = ""
    fiscal_year_end: str = ""
    financials: dict[str, dict[str, float]] = Field(default_factory=dict)
    filings: list[FilingModel] = Field(default_factory=list)
    ok: bool = False


class RunResponse(BaseModel):
    """the payload returned by /run and /demo."""

    entity: str
    count: int
    # the identity the run resolved to. `resolved` is false when the query
    # matched no SEC registrant, in which case entity is the raw typed text.
    resolved: bool = False
    cik: str = ""
    ticker: str = ""
    query: str = ""
    official: str = ""
    profile: Optional[ProfileModel] = None
    records: list[RecordModel]
    sources: list[SourceStatus]
