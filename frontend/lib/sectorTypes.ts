// shared types mirroring the sector api response and stream event shapes.

import type { SourceStatus } from "./types";

export interface SectorRecordRow {
  source: string;
  record_type: string;
  title: string;
  url: string;
  date: string;
  verified: boolean;
}

export interface SectorMetric {
  year: string;
  value: number;
}

export interface SectorCompanyFacts {
  exchange?: string;
  industry?: string;
  city?: string;
  state?: string;
  revenue?: SectorMetric | null;
  net_income?: SectorMetric | null;
}

export interface SectorCompanySection {
  ticker: string;
  name: string;
  ok: boolean;
  error: string;
  resolved: boolean;
  cik: string;
  record_count: number;
  facts: SectorCompanyFacts;
  sources: SourceStatus[];
  top_records: SectorRecordRow[];
}

export interface SectorOverview {
  companies_total: number;
  companies_ok: number;
  records_total: number;
  records_by_type: Record<string, number>;
  records_by_source: Record<string, number>;
  elapsed_seconds: number;
}

export interface SectorVerification {
  verified: number;
  total: number;
  ratio: number;
}

export interface SectorReference {
  n: number;
  url: string;
}

export interface SectorReport {
  sector: string;
  query: string;
  method: "curated" | "discovered" | "default";
  overview: SectorOverview;
  companies: SectorCompanySection[];
  verification: SectorVerification;
  references: SectorReference[];
}

// the event kinds the stream emits, in the order a successful scan sends
// them: resolved, progress xN, building, verifying, done. heartbeat can
// appear anywhere; error replaces done.
export type SectorEventKind =
  | "resolved"
  | "progress"
  | "heartbeat"
  | "building"
  | "verifying"
  | "done"
  | "error";

export interface SectorResolvedEvent {
  sector: string;
  method: string;
  total: number;
  tickers: string[];
}

export interface SectorProgressEvent {
  done: number;
  total: number;
  ticker: string;
  ok: boolean;
}
