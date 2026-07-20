// thin client for the pipeline api.
//
// by default the base url is empty, so calls hit this app's own /demo and /run
// route handlers (same origin) — that is what makes a standalone deployment
// work with no separate backend. set NEXT_PUBLIC_API_URL to point directly at
// the python fastapi service instead.
import type { RunRequest, RunResponse } from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function fetchDemo(entity: string): Promise<RunResponse> {
  const url = `${API_BASE}/demo?entity=${encodeURIComponent(entity)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`demo request failed (${response.status})`);
  }
  return response.json();
}

export async function runPipeline(request: RunRequest): Promise<RunResponse> {
  const response = await fetch(`${API_BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`run failed (${response.status})`);
  }
  return response.json();
}
