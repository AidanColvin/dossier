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
