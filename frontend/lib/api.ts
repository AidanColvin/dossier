// thin client for the pipeline api. the base url comes from the environment
// so the same build works locally and when deployed.
import type { RunRequest, RunResponse } from "./types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
