// thin client for the pipeline api.
//
// by default the base url is empty, so calls hit this app's own /demo and /run
// route handlers (same origin) — that is what makes a standalone deployment
// work with no separate backend. set NEXT_PUBLIC_API_URL to point the browser
// directly at the python fastapi service instead.
//
// /run answers with an `x-dossier-mode` header saying whether the payload came
// from the real pipeline or from the bundled sample, so the ui can be honest
// about which one the visitor is looking at rather than passing demo data off
// as a live result.
import type { RunMode, RunRequest, RunResponse } from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export async function fetchDemo(
  entity: string
): Promise<{ response: RunResponse; mode: RunMode }> {
  const url = `${API_BASE}/demo?entity=${encodeURIComponent(entity)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`demo request failed (${response.status})`);
  }
  // On a backend-connected deployment /demo returns a real pipeline run, so
  // trust the header rather than assuming this is always sample data.
  const mode = response.headers.get("x-dossier-mode") === "live" ? "live" : "demo";
  return { response: await response.json(), mode };
}

export async function runPipeline(
  request: RunRequest
): Promise<{ response: RunResponse; mode: RunMode }> {
  const response = await fetch(`${API_BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`run failed (${response.status})`);
  }
  // A direct FastAPI backend won't set the header; anything that reaches it is
  // live by definition, so treat a missing header as live.
  const mode = response.headers.get("x-dossier-mode") === "demo" ? "demo" : "live";
  return { response: await response.json(), mode };
}

/**
 * takes nothing
 * return the list of source keys the backend exposes, or null when the
 * endpoint is unavailable — callers fall back to the bundled source list
 *
 * only meaningful against a real backend: on a standalone deployment
 * `/sources` is this app's own Sources *page*, not a json endpoint, so the
 * empty-base case bails out before fetching.
 */
export async function fetchSources(): Promise<string[] | null> {
  if (!API_BASE) return null;
  try {
    const response = await fetch(`${API_BASE}/sources`);
    if (!response.ok) return null;
    const body = (await response.json()) as { sources?: string[] };
    return body.sources ?? null;
  } catch {
    return null;
  }
}
