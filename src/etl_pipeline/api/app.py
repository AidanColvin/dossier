"""fastapi application exposing the pipeline over http.

run it with:
  uvicorn etl_pipeline.api.app:app --reload
"""
from typing import Optional

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from etl_pipeline import __version__
from etl_pipeline.api.schemas import (
    RunRequest,
    RunResponse,
    SectorRequest,
    SectorResponse,
)
from etl_pipeline.api.service import (
    demo_result,
    run_pipeline,
    run_sector_pipeline,
    sector_event_stream,
    to_response,
)
from etl_pipeline.http_client import Fetcher
from etl_pipeline.registry import available_sources


def get_fetcher() -> Optional[Fetcher]:
    """
    takes nothing
    return None so the pipeline builds its real fetcher; tests override this
    """
    return None


def create_app() -> FastAPI:
    """
    takes nothing
    return a configured fastapi application
    """
    app = FastAPI(
        title="multi-source-etl-pipeline",
        version=__version__,
        description="extract public research and company data from four keyless sources.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict:
        """report that the service is up."""
        return {"status": "ok", "version": __version__}

    @app.get("/sources")
    def sources() -> dict:
        """list the available source names."""
        return {"sources": available_sources()}

    @app.post("/run", response_model=RunResponse)
    def run(request: RunRequest, fetcher: Optional[Fetcher] = Depends(get_fetcher)) -> RunResponse:
        """run the pipeline live for the requested entity."""
        return to_response(run_pipeline(request, http=fetcher))

    @app.get("/demo", response_model=RunResponse)
    def demo(entity: str = "NVIDIA") -> RunResponse:
        """return a pre-baked result so the ui works with no network."""
        return to_response(demo_result(entity))

    @app.post("/sector", response_model=SectorResponse)
    def sector(request: SectorRequest,
               fetcher: Optional[Fetcher] = Depends(get_fetcher)) -> SectorResponse:
        """run a sector scan and return the finished report in one response."""
        return SectorResponse(**run_sector_pipeline(request, http=fetcher))

    @app.get("/sector/stream")
    def sector_stream(sector: str = Query(..., min_length=1, max_length=80),
                      max_companies: int = Query(8, ge=1, le=8),
                      fetcher: Optional[Fetcher] = Depends(get_fetcher)) -> StreamingResponse:
        """run a sector scan, streaming progress as server-sent events."""
        return StreamingResponse(
            sector_event_stream(sector, http=fetcher,
                                max_companies=max_companies),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"})

    return app


app = create_app()
