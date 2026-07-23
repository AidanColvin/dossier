"""fastapi application exposing the pipeline over http.

run it with:
  uvicorn etl_pipeline.api.app:app --reload
"""
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from etl_pipeline import __version__
import os
from pathlib import Path as FilePath

from etl_pipeline.api.schemas import (
    DirectoryResponse,
    PartnershipResponse,
    ProjectEntry,
    ProjectFull,
    ProjectSaveRequest,
    RunRequest,
    RunResponse,
    SectorRequest,
    SectorResponse,
)
from etl_pipeline.api.service import (
    demo_result,
    run_partnership_lookup,
    run_pipeline,
    run_sector_pipeline,
    sector_event_stream,
    to_response,
)
from etl_pipeline.config import load_config
from etl_pipeline.directory.companies import (
    directory_csv,
    fetch_directory,
    list_exchanges,
    query_directory,
)
from etl_pipeline.http_client import Fetcher, build_fetcher
from etl_pipeline.registry import available_sources
from etl_pipeline.store import projects as project_store


def get_fetcher() -> Optional[Fetcher]:
    """
    takes nothing
    return None so the pipeline builds its real fetcher; tests override this
    """
    return None


def get_db_path() -> FilePath:
    """
    takes nothing
    return the projects database path, env-overridable; tests override this
    """
    return FilePath(os.environ.get("DOSSIER_DB_PATH",
                                   str(project_store.DEFAULT_DB_PATH)))


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

    @app.get("/partnerships", response_model=PartnershipResponse)
    def partnerships(company: str = Query(..., min_length=1, max_length=80),
                     institution: str = Query(..., min_length=1, max_length=120),
                     fetcher: Optional[Fetcher] = Depends(get_fetcher)) -> PartnershipResponse:
        """find sourced links between a company and a research institution."""
        return run_partnership_lookup(company, institution, http=fetcher)

    @app.get("/directory", response_model=DirectoryResponse)
    def directory(search: str = Query("", max_length=80),
                  exchange: str = Query("", max_length=40),
                  sort: str = Query("name", max_length=20),
                  order: str = Query("asc", pattern="^(asc|desc)$"),
                  limit: int = Query(50, ge=1, le=200),
                  offset: int = Query(0, ge=0),
                  fetcher: Optional[Fetcher] = Depends(get_fetcher)) -> DirectoryResponse:
        """search, filter, and page every sec-listed company."""
        companies = fetch_directory(fetcher or build_fetcher(load_config()))
        page = query_directory(companies, search=search, exchange=exchange,
                               sort=sort, order=order, limit=limit,
                               offset=offset)
        return DirectoryResponse(total=page["total"],
                                 exchanges=list_exchanges(companies),
                                 companies=page["companies"])

    @app.get("/directory.csv")
    def directory_export(search: str = Query("", max_length=80),
                         exchange: str = Query("", max_length=40),
                         fetcher: Optional[Fetcher] = Depends(get_fetcher)) -> StreamingResponse:
        """download the filtered directory as csv."""
        companies = fetch_directory(fetcher or build_fetcher(load_config()))
        page = query_directory(companies, search=search, exchange=exchange,
                               limit=len(companies) or 1)
        text = directory_csv(page["companies"])
        return StreamingResponse(
            iter([text]), media_type="text/csv",
            headers={"Content-Disposition":
                     "attachment; filename=dossier-directory.csv"})

    @app.post("/projects", response_model=ProjectEntry, status_code=201)
    def save_project(request: ProjectSaveRequest,
                     db: FilePath = Depends(get_db_path)) -> ProjectEntry:
        """save one finished run as a named project."""
        return ProjectEntry(**project_store.save_project(
            request.name, request.mode, request.subject, request.payload,
            path=db))

    @app.get("/projects", response_model=list[ProjectEntry])
    def list_projects(db: FilePath = Depends(get_db_path)) -> list[ProjectEntry]:
        """list saved projects, newest first, without payloads."""
        return [ProjectEntry(**entry)
                for entry in project_store.list_projects(path=db)]

    @app.get("/projects/{project_id}", response_model=ProjectFull)
    def get_project(project_id: str,
                    db: FilePath = Depends(get_db_path)) -> ProjectFull:
        """return one saved project with its payload."""
        project = project_store.get_project(project_id, path=db)
        if project is None:
            raise HTTPException(status_code=404, detail="project not found")
        return ProjectFull(**project)

    @app.delete("/projects/{project_id}", status_code=204)
    def delete_project(project_id: str,
                       db: FilePath = Depends(get_db_path)) -> None:
        """delete one saved project."""
        if not project_store.delete_project(project_id, path=db):
            raise HTTPException(status_code=404, detail="project not found")

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
