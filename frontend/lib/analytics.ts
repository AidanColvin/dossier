// derived statistics over a record set. every aggregation the Analytics,
// Home and Compare views draw lives here, so the numbers on one page can
// never disagree with the numbers on another.
import type { PipelineRecord, RunResponse, SourceStatus } from "./types";

export interface Bucket {
  key: string;
  count: number;
}

/**
 * given a list of records and a function picking a bucket key from each
 * return the buckets sorted by descending count, ties broken by key, so the
 * bar charts are stable between renders
 */
export function countBy(
  records: PipelineRecord[],
  pick: (record: PipelineRecord) => string
): Bucket[] {
  const totals = new Map<string, number>();
  for (const record of records) {
    const key = pick(record);
    if (!key) continue;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return [...totals.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * given a list of records
 * return one bucket per calendar year in ascending order, with the empty
 * years in between filled in so the timeline has no phantom gaps
 */
export function byYear(records: PipelineRecord[]): Bucket[] {
  const years = countBy(records, (record) => record.date.slice(0, 4));
  if (years.length === 0) return [];
  const numeric = years
    .map((bucket) => Number(bucket.key))
    .filter((year) => Number.isFinite(year) && year > 1900);
  if (numeric.length === 0) return [];

  const lookup = new Map(years.map((bucket) => [bucket.key, bucket.count]));
  const first = Math.min(...numeric);
  const last = Math.max(...numeric);
  const filled: Bucket[] = [];
  for (let year = first; year <= last; year += 1) {
    const key = String(year);
    filled.push({ key, count: lookup.get(key) ?? 0 });
  }
  return filled;
}

export interface RunSummary {
  total: number;
  verified: number;
  /** verified as a whole-number percentage of total. */
  verifiedPct: number;
  /** sources that returned at least one record. */
  sourcesOk: number;
  sourcesTotal: number;
  failed: SourceStatus[];
  /** distinct record_type values present. */
  types: number;
  /** the newest and oldest dates present, or empty strings when unknown. */
  newest: string;
  oldest: string;
  /** total distinct provenance urls across every record. */
  provenanceLinks: number;
}

/**
 * given a run response
 * return the headline numbers shown on the stat tiles
 */
export function summarize(response: RunResponse | null): RunSummary {
  const records = response?.records ?? [];
  const sources = response?.sources ?? [];
  const verified = records.filter((record) => record.verified).length;
  const dates = records
    .map((record) => record.date)
    .filter(Boolean)
    .sort();
  const provenance = new Set<string>();
  for (const record of records) {
    for (const url of record.sources ?? []) provenance.add(url);
  }

  return {
    total: records.length,
    verified,
    verifiedPct: records.length
      ? Math.round((verified / records.length) * 100)
      : 0,
    sourcesOk: sources.filter((source) => source.ok).length,
    sourcesTotal: sources.length,
    failed: sources.filter((source) => !source.ok),
    types: new Set(records.map((record) => record.record_type)).size,
    newest: dates.at(-1) ?? "",
    oldest: dates.at(0) ?? "",
    provenanceLinks: provenance.size,
  };
}

/**
 * given a record
 * return how many distinct provenance urls back it — the number the
 * min_sources threshold is compared against
 */
export function provenanceCount(record: PipelineRecord): number {
  return new Set(record.sources ?? []).size;
}
