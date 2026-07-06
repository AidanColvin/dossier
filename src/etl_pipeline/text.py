"""small, single-purpose string helpers used across every stage."""
import re

_WHITESPACE = re.compile(r"\s+")
_SLUG_JUNK = re.compile(r"[^a-z0-9]+")


def as_text(value: object) -> str:
    """
    given any value
    return it as a stripped string, or '' when it is None
    """
    if value is None:
        return ""
    return str(value).strip()


def collapse_whitespace(text: str) -> str:
    """
    given a string
    return it with internal runs of whitespace collapsed to single spaces
    """
    return _WHITESPACE.sub(" ", as_text(text))


def first_nonempty(*values: object) -> str:
    """
    given several values
    return the first that is non-empty once converted to stripped text
    """
    for value in values:
        text = as_text(value)
        if text:
            return text
    return ""


def slugify(text: str) -> str:
    """
    given a string
    return a lowercase, hyphen-separated slug of it
    """
    lowered = as_text(text).lower()
    return _SLUG_JUNK.sub("-", lowered).strip("-")


def dig(mapping: object, *keys: str) -> object:
    """
    given a mapping and a path of keys
    return the nested value, or None when any key along the path is missing
    """
    current = mapping
    for key in keys:
        if not isinstance(current, dict):
            return None
        current = current.get(key)
    return current
