"""provenance validation for records.

a source url only counts when it is well-formed, reputable, and distinct:

  1. well-formedness — an http(s) url with a host. bare strings like
     "sec.gov" or "javascript:…" never count.
  2. reputability — a .gov or .edu host, one of the recognized primary
     research hosts in REPUTABLE_ORGS, or (when supplied) the subject's own
     domain. anything on the aggregator BLOCKLIST is rejected first.
  3. distinctness — the same url listed twice is one source.

a record is verified once at least config.min_sources_to_verify distinct
reputable sources remain.
"""
from urllib.parse import urlparse

from etl_pipeline.config import Config
from etl_pipeline.models import Record

# aggregator / user-editable hosts that must never count as primary sources.
BLOCKLIST = (
    "wikipedia.org", "crunchbase.com", "zoominfo.com",
    "linkedin.com", "glassdoor.com", "indeed.com",
)

# recognized non-.gov/.edu hosts that are primary for this pipeline's sources.
REPUTABLE_ORGS = (
    "openalex.org", "doi.org", "clinicaltrials.gov",
    "sec.gov", "nih.gov",
)


def normalize_url(url: str) -> tuple[str, str] | None:
    """
    given a candidate source string
    return (host, canonical_url) for a well-formed http(s) url, else None
    """
    try:
        parsed = urlparse((url or "").strip())
    except (ValueError, AttributeError):
        return None
    if parsed.scheme not in ("http", "https"):
        return None
    host = (parsed.hostname or "").lower()
    if not host:
        return None
    canonical = f"{parsed.scheme}://{host}{parsed.path.rstrip('/')}"
    if parsed.query:
        canonical += f"?{parsed.query}"
    return host, canonical


def host_matches(host: str, domains: tuple[str, ...]) -> bool:
    """
    given a host and a tuple of domains
    return true if the host equals or is a subdomain of any of them
    """
    return any(host == domain or host.endswith("." + domain) for domain in domains)


def is_reputable(host: str, company_domains: tuple[str, ...] = ()) -> bool:
    """
    given a host and optional company domains
    return true when the host is a primary, non-blocklisted source
    """
    if host_matches(host, BLOCKLIST):
        return False
    if host.endswith(".gov") or host.endswith(".edu"):
        return True
    if host_matches(host, REPUTABLE_ORGS):
        return True
    return bool(company_domains) and host_matches(host, company_domains)


def distinct_reputable(urls: list[str],
                       company_domains: tuple[str, ...] = ()) -> list[str]:
    """
    given candidate source urls and optional company domains
    return the reputable ones with duplicate urls removed, order preserved
    """
    clean: list[str] = []
    seen: set[str] = set()
    for url in urls or []:
        normalized = normalize_url(url)
        if not normalized:
            continue
        host, canonical = normalized
        if not is_reputable(host, company_domains):
            continue
        if canonical in seen:
            continue
        seen.add(canonical)
        clean.append(url)
    return clean


def verify_record(record: Record, config: Config,
                  company_domains: tuple[str, ...] = ()) -> Record:
    """
    given a record and a config
    return the record with its sources cleaned and its verified flag set
    """
    clean = distinct_reputable(record.sources, company_domains)
    record.sources = clean
    record.extra["source_count"] = len(clean)
    record.verified = len(clean) >= config.min_sources_to_verify
    return record
