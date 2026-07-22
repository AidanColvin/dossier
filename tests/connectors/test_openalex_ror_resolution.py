"""Institution resolution picks the right OpenAlex entity for a company."""
from etl_pipeline.connectors import openalex


def _institutions(*entries):
    """Takes institution dicts. Returns a mock institutions payload."""
    return {"results": list(entries)}


def _http_returning(payload):
    """Takes a payload. Returns a fetcher that always yields it."""
    def http(method, url, **kwargs):
        return payload
    return http


def test_resolves_apple_to_the_us_company_not_the_foreign_cluster():
    """The US company wins over a same-named, more-published foreign entity."""
    http = _http_returning(
        _institutions(
            {"id": "https://openalex.org/I1", "display_name": "Apple (Israel)",
             "ror": "https://ror.org/04ehjr030", "type": "company",
             "country_code": "IL", "works_count": 18867},
            {"id": "https://openalex.org/I2", "display_name": "Apple (United States)",
             "ror": "https://ror.org/059hsda18", "type": "company",
             "country_code": "US", "works_count": 3119},
        )
    )
    ror, name = openalex.resolve_openalex_institution("Apple", http)
    assert ror == "059hsda18"
    assert "United States" in name


def test_prefers_a_company_over_a_same_named_university():
    http = _http_returning(
        _institutions(
            {"id": "https://openalex.org/I1", "display_name": "Apple University",
             "ror": "https://ror.org/uni", "type": "education",
             "country_code": "US", "works_count": 900},
            {"id": "https://openalex.org/I2", "display_name": "Apple Inc",
             "ror": "https://ror.org/059hsda18", "type": "company",
             "country_code": "US", "works_count": 200},
        )
    )
    ror, _ = openalex.resolve_openalex_institution("Apple", http)
    assert ror == "059hsda18"


def test_returns_empty_when_nothing_matches():
    http = _http_returning({"results": []})
    ror, name = openalex.resolve_openalex_institution("Some Private Lab", http)
    assert ror == ""
    assert name == ""
