// Shared types for the deterministic summary generators. These describe the
// shape of the data the lede and comparison functions read, and the derived
// facts they compute before rendering a sentence.

import type { CompanyProfile, PipelineRecord } from "@/lib/types";

/** A normalized set of records for one company, plus its optional profile. */
export interface RecordSet {
  entity: string;
  records: PipelineRecord[];
  profile?: CompanyProfile | null;
}

/** One source and how many records it contributed. */
export interface SourceCount {
  source: string;
  count: number;
}

/** One year and how many records fall in it. */
export interface YearCount {
  year: number;
  count: number;
}

/**
 * The derived facts a lede is built from. Every field is computed from the
 * record set with no randomness, so the same set always yields the same lede.
 */
export interface LedeContext {
  entity: string;
  total: number;
  verified: number;
  sources: SourceCount[];
  firstYear: number | null;
  lastYear: number | null;
  busiestYear: YearCount | null;
  /** The dominant record type within the busiest year, for a safe descriptor. */
  busiestYearLeadType: string | null;
  provenanceLinks: number;
}

/** The derived facts a comparison sentence is built from. */
export interface ComparisonContext {
  left: LedeContext;
  right: LedeContext;
}
