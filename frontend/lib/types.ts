// shared types mirroring the api response shapes.

/** How a record was tied to the entity. Additive, per-source. */
export interface Verification {
  method:
    | "cik_match"
    | "sponsor_match"
    | "awardee_match"
    | "author_affiliation"
    | string;
  matched_on: string;
  strict: boolean;
}

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
  verification?: Verification;
  extra: Record<string, unknown>;
}

export interface SourceStatus {
  source: string;
  ok: boolean;
  error: string;
  count: number;
}

/** one recent SEC filing shown on a company profile. */
export interface Filing {
  form: string;
  filed: string;
  accession: string;
  url: string;
}

/**
 * the fact banner and financial history for a resolved company.
 * `financials` is metric -> { fiscal year: value }, e.g.
 * { revenue: { "2024": 391035000000 } }. absent for anything that did not
 * resolve to an SEC registrant.
 */
export interface CompanyProfile {
  name: string;
  cik: string;
  ticker: string;
  exchange: string;
  industry: string;
  city: string;
  state: string;
  website: string;
  fiscal_year_end: string;
  financials: Record<string, Record<string, number>>;
  filings: Filing[];
  ok: boolean;
}

export interface RunResponse {
  entity: string;
  count: number;
  records: PipelineRecord[];
  sources: SourceStatus[];
  /** what the query resolved to; false when no SEC registrant matched. */
  resolved?: boolean;
  cik?: string;
  ticker?: string;
  query?: string;
  official?: string;
  profile?: CompanyProfile | null;
}

export interface RunRequest {
  entity: string;
  ticker?: string;
  sources?: string[] | null;
  max_results?: number;
  min_sources?: number;
}

/** How a result was obtained - drives the "demo vs live" messaging. */
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
