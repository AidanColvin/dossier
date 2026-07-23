"""institution resolution: turn a typed institution name into identifiers.

mirrors company entity resolution: an alias map catches the colloquial forms
people actually type ("unc", "mit"), then one openalex institutions search
produces the canonical name and ror id every downstream lookup uses. no ror
ids are hardcoded here; openalex is the authority.
"""
from dataclasses import dataclass

from etl_pipeline.connectors.openalex import INSTITUTIONS_ENDPOINT
from etl_pipeline.http_client import Fetcher
from etl_pipeline.text import as_text

# colloquial name -> the full name openalex indexes. keys are lowercase;
# canonical_institution lowercases input before looking here.
INSTITUTION_ALIASES: dict[str, str] = {
    "unc": "University of North Carolina at Chapel Hill",
    "unc chapel hill": "University of North Carolina at Chapel Hill",
    "university of north carolina": "University of North Carolina at Chapel Hill",
    "mit": "Massachusetts Institute of Technology",
    "berkeley": "University of California, Berkeley",
    "uc berkeley": "University of California, Berkeley",
    "ucla": "University of California, Los Angeles",
    "cmu": "Carnegie Mellon University",
    "carnegie mellon": "Carnegie Mellon University",
    "jhu": "Johns Hopkins University",
    "johns hopkins": "Johns Hopkins University",
    "nyu": "New York University",
    "usc": "University of Southern California",
    "penn": "University of Pennsylvania",
    "upenn": "University of Pennsylvania",
    "gatech": "Georgia Institute of Technology",
    "georgia tech": "Georgia Institute of Technology",
}


@dataclass
class Institution:
    """a resolved research institution, or an unresolved passthrough.

    resolved is False when openalex knows nothing matching, in which case
    name is just the text the caller typed and lookups that need a ror id
    fall back to name search.
    """

    name: str
    resolved: bool = False
    ror_id: str = ""
    openalex_id: str = ""
    query: str = ""


def canonical_institution(text: str) -> str:
    """
    given free institution text
    return the full name to search for, aliases applied
    """
    cleaned = " ".join(text.strip().split())
    return INSTITUTION_ALIASES.get(cleaned.lower(), cleaned)


def resolve_institution(text: str, http: Fetcher) -> Institution:
    """
    given free institution text and a fetcher
    return the resolved institution, falling back to the typed text

    ranks education-type matches first so "washington" finds the university
    and not a company, then prefers the name people asked for, with works
    count last so a bigger same-named campus system never shadows an exact
    match.
    """
    typed = canonical_institution(text)
    fallback = Institution(name=typed, resolved=False, query=text.strip())
    if not typed:
        return fallback

    try:
        payload = http(
            "GET",
            INSTITUTIONS_ENDPOINT,
            params={
                "search": typed,
                "per-page": 10,
                "select": "id,display_name,ror,type,works_count",
            },
        )
    except Exception:  # noqa: BLE001 - resolution is best-effort, never fatal
        return fallback

    results = (payload or {}).get("results") or []
    if not results:
        return fallback

    wanted = typed.lower()

    def rank(institution: dict) -> tuple:
        is_education = as_text(institution.get("type")) == "education"
        name = as_text(institution.get("display_name")).lower()
        exact = name.startswith(wanted)
        works = institution.get("works_count") or 0
        return (is_education, exact, works)

    best = max(results, key=rank)
    if as_text(best.get("type")) != "education":
        return fallback

    ror = as_text(best.get("ror"))
    return Institution(
        name=as_text(best.get("display_name")) or typed,
        resolved=True,
        ror_id=ror.rstrip("/").split("/")[-1] if ror else "",
        openalex_id=as_text(best.get("id")),
        query=text.strip(),
    )
