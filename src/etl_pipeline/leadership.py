"""executive extraction from sec form 4 filings.

a form 4 (insider transaction) names its reporting owner and, for officers,
their exact title, in machine-readable xml. that is far cleaner than parsing
a 10-K officer table. the extractor reads a handful of recent form 4s,
keeps the officers, fixes name order and title casing, ranks by seniority,
and returns the top few. standard library only; the xml fields are simple
enough that anchored regexes are more robust than a parser against the
occasional malformed filing.
"""
import re
from dataclasses import dataclass

from etl_pipeline.http_client import TextFetcher

MAX_FORM4_FETCHES = 12
MAX_LEADERS = 6
ENOUGH_LEADERS = 3

# edgar's primary-document path for a form 4 often routes through an xsl
# stylesheet segment that returns rendered html; the raw xml lives at the
# same path with that segment removed.
_XSL_SEGMENT = re.compile(r"/xsl[^/]+/")

_OWNER_BLOCK = re.compile(r"<reportingOwner>(.*?)</reportingOwner>", re.DOTALL)
_NAME = re.compile(r"<rptOwnerName>([^<]*)</rptOwnerName>")
_TITLE = re.compile(r"<officerTitle>([^<]*)</officerTitle>")
_IS_OFFICER = re.compile(r"<isOfficer>([^<]*)</isOfficer>")

NAME_SUFFIXES = {"JR", "SR", "II", "III", "IV", "V"}

# seniority order for ranking; anything unmatched sorts after these.
_TITLE_RANKS = [
    "chief executive", "ceo", "president", "chief financial", "cfo",
    "chief operating", "coo", "chief technology", "cto", "chair",
    "executive vice president", "evp", "senior vice president", "svp",
    "general counsel", "vice president",
]

_SMALL_WORDS = {"of", "and", "the", "for"}
_ACRONYMS = {"ceo", "cfo", "coo", "cto", "evp", "svp", "vp", "cao", "cio", "gc"}


@dataclass
class Leader:
    """one named officer and their title, as filed."""

    name: str
    title: str


def fix_name_order(raw: str) -> str:
    """
    given a form 4 owner name, stored last-first
    return it first-last, suffix aware

    "HUANG JEN HSUN" becomes "Jen Hsun Huang"; "FORD WILLIAM CLAY JR"
    becomes "William Clay Ford Jr". single-word names pass through.
    """
    words = [w for w in raw.strip().split() if w]
    if len(words) < 2:
        return raw.strip().title()
    suffix = ""
    if words[-1].upper().rstrip(".") in NAME_SUFFIXES:
        suffix = words.pop().title().rstrip(".")
    last, rest = words[0], words[1:]
    ordered = rest + [last] + ([suffix] if suffix else [])
    return " ".join(word.title() for word in ordered)


def fix_title_case(raw: str) -> str:
    """
    given an officer title, often stored upper
    return it in headline case, acronyms kept upper and joiners kept lower
    """
    words = []
    for word in raw.replace("&amp;", "&").split():
        bare = word.strip(",.&").lower()
        if bare in _ACRONYMS:
            words.append(word.upper())
        elif bare in _SMALL_WORDS and words:
            words.append(word.lower())
        else:
            words.append(word.capitalize() if word.isupper() or word.islower()
                         else word)
    return " ".join(words)


def title_rank(title: str) -> int:
    """
    given an officer title
    return its seniority rank, lower being more senior
    """
    wanted = title.lower()
    for rank, marker in enumerate(_TITLE_RANKS):
        if marker in wanted:
            return rank
    return len(_TITLE_RANKS)


def parse_form4(xml: str) -> list[Leader]:
    """
    given one form 4 document
    return its officer owners as leaders, non-officers dropped
    """
    leaders = []
    for block in _OWNER_BLOCK.findall(xml):
        officer_flag = _IS_OFFICER.search(block)
        if officer_flag and officer_flag.group(1).strip() not in {"1", "true"}:
            continue
        title_match = _TITLE.search(block)
        name_match = _NAME.search(block)
        if not name_match or not title_match:
            continue
        title = title_match.group(1).strip()
        if not title or title.lower() == "director":
            continue
        leaders.append(Leader(name=fix_name_order(name_match.group(1)),
                              title=fix_title_case(title)))
    return leaders


def extract_leadership(filings: list, fetch_text: TextFetcher,
                       limit: int = MAX_LEADERS) -> list[Leader]:
    """
    given a company's recent filings and a text fetcher
    return up to limit officers, most senior first, deduped by name

    reads at most a dozen recent form 4 documents, stopping early once a
    few officers are in hand: directors file form 4s too, and a company
    whose recent filings are mostly board members needs a deeper look to
    surface its actual executives. one unreadable filing is skipped rather
    than failing the profile.
    """
    seen: dict[str, Leader] = {}
    fetched = 0
    for filing in filings:
        if getattr(filing, "form", "") != "4" or not getattr(filing, "url", ""):
            continue
        if fetched >= MAX_FORM4_FETCHES or len(seen) >= ENOUGH_LEADERS:
            break
        fetched += 1
        try:
            xml = fetch_text(_XSL_SEGMENT.sub("/", filing.url))
        except Exception:  # noqa: BLE001 - one bad filing must not kill the profile
            continue
        for leader in parse_form4(xml):
            existing = seen.get(leader.name)
            if existing is None or title_rank(leader.title) < title_rank(existing.title):
                seen[leader.name] = leader
    ranked = sorted(seen.values(), key=lambda l: (title_rank(l.title), l.name))
    return ranked[:limit]
