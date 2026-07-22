"""The strict filter drops the known-bad titles OpenAlex tags as Apple."""
from etl_pipeline.connectors import openalex

BAD_TITLES = [
    "kovdan01/llvm-project-ptrenc: ptrenc",
    "Development of Dasatinib Loaded Self-Micro Emulsifying Drug Delivery System",
    "Generative AI in the age of quantum computing: A taxonomy",
    "Xilinx/brevitas: Release v0.13.0",
]


def test_software_and_dataset_dumps_are_excluded():
    payload = {
        "results": [
            {"id": "https://openalex.org/W1",
             "title": "kovdan01/llvm-project-ptrenc: ptrenc", "type": "software"},
            {"id": "https://openalex.org/W2",
             "title": "Xilinx/brevitas: Release v0.13.0", "type": "software"},
            {"id": "https://openalex.org/W3",
             "title": "Multilingual Semantic Retrieval for Apple Music",
             "type": "preprint"},
            {"id": "https://openalex.org/W4",
             "title": "Some dataset", "type": "dataset"},
        ]
    }
    records = openalex.parse_works(payload, "Apple", "ror:059hsda18", True, 25)
    titles = [r.title for r in records]
    assert titles == ["Multilingual Semantic Retrieval for Apple Music"]
    for bad in BAD_TITLES:
        assert bad not in titles
