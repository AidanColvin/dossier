"""10-K narrative extraction: the company's own words, no model.

a 10-K is one huge html document whose named items hold the real prose:
Item 1 is the business, Item 1A the risk factors, Item 7 management's
discussion. the extractor strips the html to text, finds every item marker,
keeps the longest block per item (the section itself, not the table of
contents line repeating its heading), and trims each to clean sentence
boundaries. everything here is standard library string work.
"""
import html
import re

# how much of each item survives into the profile. long enough to read as a
# real summary, short enough that the payload stays a profile and not a
# filing mirror.
BUSINESS_EXCERPT_CHARS = 900
OUTLOOK_EXCERPT_CHARS = 700
MAX_RISK_HEADLINES = 6

_TAG_PATTERN = re.compile(r"<[^>]+>")
_BLOCK_TAG_PATTERN = re.compile(
    r"</?(?:p|div|br|tr|li|h[1-6]|table|section)[^>]*>", re.IGNORECASE)
_SCRIPT_STYLE_PATTERN = re.compile(
    r"<(script|style)[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_ITEM_PATTERN = re.compile(r"\bItem\s+(\d{1,2}A?)\b[.:]?\s", re.IGNORECASE)


def html_to_text(document: str) -> str:
    """
    given filing html
    return its visible text, block boundaries kept as newlines

    source newlines collapse to spaces first, because html treats them as
    whitespace; only block-level tags become real line breaks. that keeps
    each paragraph on one line and each heading on its own, no matter how
    the filing's html happens to be wrapped. entities are decoded so smart
    quotes read as quotes and not numeric codes.
    """
    stripped = re.sub(r"[\r\n]+", " ", document)
    stripped = _SCRIPT_STYLE_PATTERN.sub(" ", stripped)
    stripped = _BLOCK_TAG_PATTERN.sub("\n", stripped)
    stripped = _TAG_PATTERN.sub(" ", stripped)
    decoded = html.unescape(stripped)
    decoded = decoded.replace(" ", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in decoded.split("\n")]
    return "\n".join(line for line in lines if line)


def slice_items(text: str) -> dict[str, str]:
    """
    given the text of a filing
    return item key -> the longest block found for that item

    every 10-K repeats its item headings at least twice (the table of
    contents and the section itself). keeping the longest block per key
    selects the real section without any layout assumptions.
    """
    matches = list(_ITEM_PATTERN.finditer(text))
    blocks: dict[str, str] = {}
    for index, match in enumerate(matches):
        key = match.group(1).upper()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        block = text[start:end].strip()
        if len(block) > len(blocks.get(key, "")):
            blocks[key] = block
    return blocks


def excerpt(text: str, max_chars: int) -> str:
    """
    given a text block and a budget
    return it trimmed to the last full sentence inside the budget

    the block often opens with the item's own title restated and a short
    subheading ("Business", "Overview"); leading lines are dropped while
    they are short and headline-shaped, so the excerpt starts with prose.
    """
    lines = text.split("\n")
    while (lines and len(lines) > 1 and len(lines[0]) < 80
           and not lines[0].rstrip().endswith(".")):
        lines = lines[1:]
    joined = " ".join(line.strip() for line in lines if line.strip())
    if len(joined) <= max_chars:
        return joined
    cut = joined[:max_chars]
    boundary = max(cut.rfind(". "), cut.rfind(".\n"))
    return cut[:boundary + 1] if boundary > max_chars // 3 else cut


def risk_headlines(item_1a: str, limit: int = MAX_RISK_HEADLINES) -> list[str]:
    """
    given the Item 1A block
    return up to limit short risk-category lines

    filings set their risk categories as short standalone header lines
    ("Risks Related to Our Operations"). a line qualifies when it is
    header-length, has no terminal period, and reads as a phrase rather
    than a sentence fragment from flowing prose.
    """
    headlines: list[str] = []
    for line in item_1a.split("\n"):
        candidate = line.strip()
        if not (15 <= len(candidate) <= 90):
            continue
        if candidate.endswith((".", ";", ",", ":")):
            continue
        words = candidate.split()
        if len(words) < 3 or len(words) > 14:
            continue
        # a header is title-shaped: most words capitalized, or it opens with
        # a risk-vocabulary word filings actually use.
        capitalized = sum(1 for w in words if w[0].isupper())
        opens_like_risk = words[0].lower() in {"risks", "risk", "we", "our"}
        if capitalized >= len(words) * 0.6 or opens_like_risk:
            if candidate not in headlines:
                headlines.append(candidate)
        if len(headlines) >= limit:
            break
    return headlines


# item 7 routinely opens with cross-reference and safe-harbor boilerplate
# before any actual discussion. sentences matching these markers are
# dropped from the front of the outlook until real prose starts.
_BOILERPLATE_MARKERS = (
    "forward-looking",
    "should be read in conjunction",
    "annual report on form",
    "quarterly report on form",
    "refer to",
    "included elsewhere",
    "table of contents",
    "the following table",
    "the following discussion",
    "expressed as a percentage",
)


def skip_boilerplate(text: str) -> str:
    """
    given an excerpt
    return it with leading boilerplate sentences removed

    stops at the first sentence that reads as discussion rather than a
    cross-reference, so nothing after the opening is ever touched.
    """
    sentences = re.split(r"(?<=\.)\s+", text)
    start = 0
    for sentence in sentences:
        lowered = sentence.lower()
        if any(marker in lowered for marker in _BOILERPLATE_MARKERS):
            start += 1
            continue
        break
    return " ".join(sentences[start:])


def extract_narrative(document: str) -> dict:
    """
    given a 10-K document's html
    return {business, risk_headlines, outlook}, any of which may be empty

    business is Item 1 in the company's own words, risk_headlines the short
    category lines of Item 1A, outlook the opening of Item 7 (management's
    discussion). nothing is generated; a missing item is an empty field.
    """
    text = html_to_text(document)
    items = slice_items(text)
    return {
        "business": excerpt(items.get("1", ""), BUSINESS_EXCERPT_CHARS),
        "risk_headlines": risk_headlines(items.get("1A", "")),
        "outlook": skip_boilerplate(
            excerpt(items.get("7", ""), OUTLOOK_EXCERPT_CHARS)),
    }
