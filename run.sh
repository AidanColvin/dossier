#!/usr/bin/env bash
# start the backend (port 8000) and frontend (port 3000) together for local dev.
# the frontend also works on its own via bundled demo data if you skip the backend.
set -e

echo "==> installing backend (editable)"
pip install -e ".[dev]" >/dev/null

echo "==> starting backend on http://localhost:8000"
uvicorn etl_pipeline.api.app:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
trap "kill $BACKEND_PID 2>/dev/null" EXIT

echo "==> installing and starting frontend on http://localhost:3000"
cd frontend
npm install
NEXT_PUBLIC_API_URL="http://localhost:8000" npm run dev
