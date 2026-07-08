"""registry of available source connectors, keyed by source name.

the pipeline never imports connector modules directly; it asks the registry
for them, so adding a source is a one-line change here.
"""
from etl_pipeline.connectors import clinicaltrials, nih_reporter, openalex, sec_edgar
from etl_pipeline.connectors.base import Connector

_CONNECTORS: dict[str, Connector] = {
    sec_edgar.NAME: sec_edgar,
    openalex.NAME: openalex,
    clinicaltrials.NAME: clinicaltrials,
    nih_reporter.NAME: nih_reporter,
}


def available_sources() -> list[str]:
    """
    takes nothing
    return the sorted names of every registered source
    """
    return sorted(_CONNECTORS)


def get_connector(name: str) -> Connector:
    """
    given a source name
    return its connector module
    raise KeyError when the name is not registered
    """
    if name not in _CONNECTORS:
        raise KeyError(f"unknown source: {name!r}")
    return _CONNECTORS[name]


def resolve_sources(names: list[str] | None) -> list[Connector]:
    """
    given a list of source names, or None for every source
    return the matching connector modules in a stable order
    """
    chosen = available_sources() if not names else list(names)
    return [get_connector(name) for name in chosen]
