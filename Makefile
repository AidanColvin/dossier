.PHONY: install test cov lint run clean

install:
	pip install -e ".[dev]"

test:
	pytest

cov:
	pytest --cov=etl_pipeline --cov-report=term-missing

run:
	python -m etl_pipeline.cli --entity "NVIDIA" --ticker NVDA --out ./out

clean:
	rm -rf out *.sqlite *.db .pytest_cache .coverage htmlcov coverage.xml
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
