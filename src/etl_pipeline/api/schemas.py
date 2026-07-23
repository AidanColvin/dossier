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
    verification: dict[str, Any] = {}
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


class SectorRequest(BaseModel):
    """the body of a POST /sector request."""

    sector: str = Field(..., min_length=1, max_length=80,
                        description="industry or sector to scan")
    max_companies: int = Field(8, ge=1, le=8,
                               description="companies to profile")


class SectorRecordRow(BaseModel):
    """one displayed record inside a company section."""

    source: str
    record_type: str
    title: str
    url: str
    date: str
    verified: bool


class SectorCompanySection(BaseModel):
    """one company's section of a sector report."""

    ticker: str
    name: str = ""
    ok: bool = True
    error: str = ""
    resolved: bool = False
    cik: str = ""
    record_count: int = 0
    facts: dict[str, Any] = {}
    sources: list[SourceStatus] = []
    top_records: list[SectorRecordRow] = []


class SectorOverview(BaseModel):
    """the aggregate counts a sector report opens with."""

    companies_total: int
    companies_ok: int
    records_total: int
    records_by_type: dict[str, int] = {}
    records_by_source: dict[str, int] = {}
    elapsed_seconds: float = 0.0


class SectorVerification(BaseModel):
    """aggregate verification stats across the scan."""

    verified: int
    total: int
    ratio: float


class SectorReference(BaseModel):
    """one numbered provenance url."""

    n: int
    url: str


class SectorResponse(BaseModel):
    """the payload returned by /sector, and the done event of the stream."""

    sector: str
    query: str
    # which path picked the companies: curated, discovered, or default.
    method: str
    overview: SectorOverview
    companies: list[SectorCompanySection]
    verification: SectorVerification
    references: list[SectorReference]


class CoauthoredPaperModel(BaseModel):
    """one co-authored work shown as partnership evidence."""

    title: str
    url: str
    date: str
    journal: str = ""


class PartnerTrialModel(BaseModel):
    """one trial tying the company to the institution."""

    nct_id: str
    title: str
    status: str
    date: str
    url: str
    is_joint: bool = False


class FacultyLeadModel(BaseModel):
    """one funded project at the institution naming the company."""

    pi_names: list[str] = []
    department: str = ""
    project_num: str = ""
    title: str = ""
    fiscal_year: str = ""
    award_amount: Optional[float] = None
    url: str = ""


class FilingMentionModel(BaseModel):
    """one company filing mentioning the institution."""

    form: str = ""
    filed: str = ""
    accession: str
    url: str


class RelationshipSignalModel(BaseModel):
    """one ranked, sourced relationship statement."""

    strength: str
    kind: str
    description: str
    url: str = ""


class LookupStatusModel(BaseModel):
    """the outcome of one partnership evidence lookup."""

    source: str
    ok: bool
    error: str = ""
    count: int = 0


class TalkingPointModel(BaseModel):
    """one ranked outreach point."""

    category: str
    headline: str
    detail: str
    strength: str
    url: str = ""


class ProjectSaveRequest(BaseModel):
    """the body of a POST /projects request."""

    name: str = Field("", max_length=120, description="display name; the subject when blank")
    mode: str = Field(..., pattern="^(company|sector|partnership)$")
    subject: str = Field(..., min_length=1, max_length=120,
                         description="the company, sector, or pair scanned")
    payload: dict[str, Any] = Field(..., description="the finished run, verbatim")


class ProjectEntry(BaseModel):
    """one row of the projects listing."""

    id: str
    name: str
    mode: str
    subject: str
    saved_at: str


class ProjectFull(ProjectEntry):
    """a project with its saved payload."""

    payload: dict[str, Any]


class PartnershipResponse(BaseModel):
    """the payload returned by /partnerships."""

    company: str
    company_resolved: bool
    ticker: str = ""
    cik: str = ""
    institution: str
    institution_resolved: bool
    papers: list[CoauthoredPaperModel] = []
    trials: list[PartnerTrialModel] = []
    faculty_leads: list[FacultyLeadModel] = []
    filing_mentions: list[FilingMentionModel] = []
    signals: list[RelationshipSignalModel] = []
    talking_points: list[TalkingPointModel] = []
    statuses: list[LookupStatusModel] = []
    elapsed_seconds: float = 0.0
