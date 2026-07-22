// The lede generator. Takes a record set and returns a two to four sentence
// paragraph summarizing it. Pure and deterministic: no randomness, no network,
// no language model. The same record set always produces the same paragraph.

import type { PipelineRecord } from "@/lib/types";
import type { LedeContext, RecordSet, SourceCount, YearCount } from "./types";
import { pickHeadline } from "./pickHeadline";

// buildContext still backs generateComparison, which needs the aggregate
// shape (source counts, busiest year) to contrast two companies. The lede
// itself no longer reads from it: a reader does not care how many records are
// in the index, only what the company is doing, which pickHeadline answers
// from the records directly.

/** Takes a record. Returns its four digit year, or null when undated. */
function yearOf(record: PipelineRecord): number | null {
  const year = Number(record.date.slice(0, 4));
  return Number.isFinite(year) && year > 1900 ? year : null;
}

/**
 * Takes a record set. Returns the derived facts a lede is built from. This is
 * the deterministic core: every downstream sentence reads only from here.
 */
export function buildContext(set: RecordSet): LedeContext {
  const records = set.records ?? [];

  const bySource = new Map<string, number>();
  const byYear = new Map<number, number>();
  const typeByYear = new Map<number, Map<string, number>>();
  const provenance = new Set<string>();
  let verified = 0;

  for (const record of records) {
    bySource.set(record.source, (bySource.get(record.source) ?? 0) + 1);
    if (record.verified) verified += 1;
    for (const url of record.sources ?? []) provenance.add(url);

    const year = yearOf(record);
    if (year !== null) {
      byYear.set(year, (byYear.get(year) ?? 0) + 1);
      const types = typeByYear.get(year) ?? new Map<string, number>();
      types.set(record.record_type, (types.get(record.record_type) ?? 0) + 1);
      typeByYear.set(year, types);
    }
  }

  // Sources sorted by descending count, ties broken by key for stability.
  const sources: SourceCount[] = [...bySource.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const firstYear = years[0] ?? null;
  const lastYear = years[years.length - 1] ?? null;

  // The busiest year, ties broken toward the most recent year.
  let busiestYear: YearCount | null = null;
  for (const [year, count] of byYear) {
    if (
      busiestYear === null ||
      count > busiestYear.count ||
      (count === busiestYear.count && year > busiestYear.year)
    ) {
      busiestYear = { year, count };
    }
  }

  // The dominant record type inside the busiest year, for a safe descriptor
  // drawn from the data rather than an invented topic.
  let busiestYearLeadType: string | null = null;
  if (busiestYear) {
    const types = typeByYear.get(busiestYear.year);
    if (types) {
      let best = -1;
      for (const [type, count] of types) {
        if (count > best) {
          best = count;
          busiestYearLeadType = type;
        }
      }
    }
  }

  return {
    entity: set.entity,
    total: records.length,
    verified,
    sources,
    firstYear,
    lastYear,
    busiestYearLeadType,
    busiestYear,
    provenanceLinks: provenance.size,
  };
}

/**
 * Takes a record set. Returns the lede: one or two sentences naming what the
 * company is actually doing, chosen by pickHeadline. No record counts, no
 * source counts, no date span; that bookkeeping lives in the footer, where a
 * reader can find it if they want it but is never made to read it first.
 */
export function generateLede(set: RecordSet): string {
  return pickHeadline({ entity: set.entity, records: set.records });
}
