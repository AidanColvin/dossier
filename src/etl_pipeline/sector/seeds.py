"""curated sector seed lists.

each sector maps to tickers of large public companies that clearly belong to
it. curation keeps common sectors fast and deterministic; anything not listed
here falls through to live discovery instead of failing.
"""

# canonical sector name -> seed tickers, largest and clearest members first.
# capped downstream, so order is priority order.
SECTOR_SEEDS: dict[str, list[str]] = {
    "semiconductors": ["NVDA", "AMD", "INTC", "AVGO", "QCOM", "MU", "TXN", "ADI"],
    "software": ["MSFT", "ORCL", "CRM", "ADBE", "NOW", "INTU", "SNOW", "PLTR"],
    "pharmaceuticals": ["LLY", "PFE", "MRK", "JNJ", "ABBV", "BMY", "AMGN", "GILD"],
    "biotechnology": ["AMGN", "GILD", "VRTX", "REGN", "MRNA", "BIIB", "ILMN", "ALNY"],
    "medical devices": ["MDT", "ABT", "SYK", "BSX", "ISRG", "EW", "ZBH", "DXCM"],
    "banking": ["JPM", "BAC", "WFC", "C", "GS", "MS", "USB", "PNC"],
    "insurance": ["UNH", "ELV", "CI", "PGR", "TRV", "AIG", "MET", "ALL"],
    "aerospace and defense": ["BA", "LMT", "RTX", "NOC", "GD", "LHX", "HWM", "TDG"],
    "automotive": ["TSLA", "F", "GM", "RIVN", "APTV", "BWA", "LEA", "ALV"],
    "energy": ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "OXY"],
    "renewable energy": ["NEE", "FSLR", "ENPH", "RUN", "SEDG", "BE", "PLUG", "AES"],
    "retail": ["WMT", "AMZN", "COST", "TGT", "HD", "LOW", "TJX", "DG"],
    "telecommunications": ["T", "VZ", "TMUS", "CMCSA", "CHTR", "LUMN", "FYBR", "USM"],
    "airlines": ["DAL", "UAL", "AAL", "LUV", "ALK", "JBLU", "SAVE", "HA"],
    "cloud computing": ["AMZN", "MSFT", "GOOGL", "ORCL", "IBM", "NET", "DDOG", "SNOW"],
}

# common alternate phrasings -> canonical sector name. keys are already
# lowercase; canonical_sector lowercases input before looking here.
SECTOR_ALIASES: dict[str, str] = {
    "chips": "semiconductors",
    "chipmakers": "semiconductors",
    "semis": "semiconductors",
    "pharma": "pharmaceuticals",
    "drug makers": "pharmaceuticals",
    "biotech": "biotechnology",
    "medtech": "medical devices",
    "banks": "banking",
    "defense": "aerospace and defense",
    "aerospace": "aerospace and defense",
    "autos": "automotive",
    "cars": "automotive",
    "ev": "automotive",
    "electric vehicles": "automotive",
    "oil and gas": "energy",
    "oil": "energy",
    "clean energy": "renewable energy",
    "solar": "renewable energy",
    "telecom": "telecommunications",
    "cloud": "cloud computing",
    "saas": "software",
}

# used only when a sector matches nothing curated and live discovery also
# comes back empty, so a scan always has something to report on.
DEFAULT_SEEDS: list[str] = ["AAPL", "MSFT", "AMZN", "GOOGL", "JPM"]


def canonical_sector(text: str) -> str:
    """
    given free sector text
    return the canonical lowercase sector name, aliases applied
    """
    cleaned = " ".join(text.strip().lower().split())
    return SECTOR_ALIASES.get(cleaned, cleaned)


def curated_seeds(sector: str) -> list[str]:
    """
    given a canonical sector name
    return its curated seed tickers, or an empty list when not curated
    """
    return list(SECTOR_SEEDS.get(sector, []))
