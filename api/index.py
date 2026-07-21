"""Vercel serverless entry point for the pipeline API.

Vercel's Python runtime looks for a module-level ASGI application named `app`,
so this re-exports the FastAPI service unchanged. The repo uses a src/ layout
and Vercel does not pip-install the local package, so the source tree is put on
sys.path explicitly (vercel.json bundles it via includeFiles).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from etl_pipeline.api.app import app  # noqa: E402

__all__ = ["app"]
