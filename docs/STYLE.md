# code style

Every module in this project follows the same conventions. They exist so the
code reads the same no matter which file you open.

## one function, one thing

A function does exactly one thing. If a function both fetches and parses, it is
two functions. Orchestrators (`fetch`, `run`, `transform`) are allowed to
coordinate other single-purpose functions, but they do not themselves contain
the work — they call the functions that do.

This is why, for example, the SEC connector is split into `resolve_cik`,
`fetch_submissions`, `build_filing_url`, `parse_filings`, and `fetch`: each
name is a single verb phrase you can test in isolation.

## docstrings

Every function has a docstring. Docstrings are lowercase, terse, and describe
behavior as input then output, one clause per line:

```python
def pad_cik(cik: object) -> str:
    """
    given a central index key
    return it as a zero-padded 10-digit string
    """
```

A single-line docstring is fine when one line says everything:

```python
def study_url(nct_id: str) -> str:
    """
    given an nct id
    return the public study url for that trial
    """
```

Module docstrings explain what the module is for and, where useful, cite the
upstream API or the rule the module enforces.

## type hints

Every function signature is fully typed, arguments and return value. Data is
carried in `@dataclass` models (`Record`, `Query`, …) rather than loose dicts,
so the shape is explicit and the type checker can help.

## naming

Public functions read as verb phrases (`build_params`, `verify_record`,
`dedup_records`). Private helpers are prefixed with a single underscore
(`_row_to_record`, `_resolve_ips`). Module-level constants are UPPER_CASE.

## errors

Connectors never raise out of `fetch`; they return a `SourceResult` with
`ok=False` and the error text, so one failing source cannot abort a run. The
low-level HTTP client is the opposite: it raises `HttpError` after exhausting
retries, and the connector is responsible for catching it.

## modularity

Network access exists in exactly one place — `http_client` — and reaches
connectors as an injected fetcher callable. Nothing else imports `urllib`.
That single seam is what lets the whole test suite run offline.
