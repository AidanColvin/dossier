# backend api image — builds the pipeline package and serves the fastapi app.
FROM python:3.12-slim

WORKDIR /app

# install the package (with the api extra) from source
COPY pyproject.toml README.md LICENSE ./
COPY src ./src
RUN pip install --no-cache-dir ".[api]"

EXPOSE 8000

# render and most hosts inject $PORT; fall back to 8000 locally
CMD ["sh", "-c", "uvicorn etl_pipeline.api.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
