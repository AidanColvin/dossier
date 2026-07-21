// shared types mirroring the api response shapes.

export interface PipelineRecord {
  source: string;
  record_type: string;
  native_id: string;
  title: string;
  url: string;
  date: string;
  entity: string;
  sources: string[];
  verified: boolean;
  extra: Record<string, unknown>;
}

export interface SourceStatus {
  source: string;
  ok: boolean;
  error: string;
  count: number;
}

export interface RunResponse {
  entity: string;
  count: number;
  records: PipelineRecord[];
  sources: SourceStatus[];
}

export interface RunRequest {
  entity: string;
  ticker?: string;
  sources?: string[] | null;
  max_results?: number;
  min_sources?: number;
}

/** How a result was obtained — drives the "demo vs live" messaging. */
export type RunMode = "demo" | "live";

/** A completed run plus the metadata the UI needs to describe it. */
export interface RunResult {
  response: RunResponse;
  mode: RunMode;
  /** epoch millis; set by the client when the response lands. */
  ranAt: number;
  /** the request that produced it, for the "re-run" affordance. */
  request: RunRequest;
}
