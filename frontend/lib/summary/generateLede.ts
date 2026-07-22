// The lede generator. Takes a record set and returns a two to four sentence
// paragraph summarizing it. Pure and deterministic: no randomness, no network,
// no language model. The same record set always produces the same paragraph.

import type { PipelineRecord } from "@/lib/types";
import type { LedeContext, RecordSet, SourceCount, YearCount } from "./types";
import {
  contribution,
  plural,
  sourceLabel,
  spell,
  typeLabel,
} from "./templates";

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

/** Takes a context. Returns the opening sentence about scale and span. */
function scaleSentence(context: LedeContext): string {
  const { entity, total, verified, sources, firstYear, lastYear } = context;

  if (total === 0) {
    return `${entity} has no public records across the four sources searched.`;
  }

  const noun = plural(total, "record");
  const verifiedClause =
    verified === total
      ? `${total} verified ${noun}`
      : verified > 0
        ? `${total} ${noun}, ${verified} of them verified,`
        : `${total} ${noun}`;

  const sourceClause =
    sources.length === 1
      ? `all from ${sourceLabel(sources[0].source)}`
      : `across ${spell(sources.length)} ${plural(sources.length, "source")}`;

  let spanClause = "";
  if (firstYear !== null && lastYear !== null) {
    spanClause =
      firstYear === lastYear
        ? ` in ${firstYear}`
        : `, spanning ${firstYear} to ${lastYear}`;
  }

  return `${entity} has ${verifiedClause} ${sourceClause}${spanClause}.`;
}

/** Takes a context. Returns the sentence about which sources dominate. */
function sourceSentence(context: LedeContext): string {
  const { sources } = context;
  if (sources.length < 2) return "";

  const [first, second] = sources;
  const lead = `The company is most active on ${sourceLabel(
    first.source
  )} with ${contribution(first.source, first.count)}`;

  return `${lead}, followed by ${contribution(
    second.source,
    second.count
  )} from ${sourceLabel(second.source)}.`;
}

/** Takes a context. Returns the sentence about the busiest year. */
function busiestSentence(context: LedeContext): string {
  const { busiestYear, busiestYearLeadType, total, firstYear, lastYear } = context;
  if (!busiestYear || total < 3) return "";
  // When every record falls in one year the busiest-year sentence just repeats
  // the span already stated, so it is dropped.
  if (firstYear !== null && firstYear === lastYear) return "";

  const items = `${busiestYear.count} ${plural(busiestYear.count, "item")}`;
  const descriptor = busiestYearLeadType
    ? `, led by ${plural(2, typeLabel(busiestYearLeadType))}`
    : "";

  return `${busiestYear.year} is the busiest year on record with ${items}${descriptor}.`;
}

/**
 * Takes a record set. Returns the generated lede paragraph, two to four
 * sentences long. Handles the empty, single record, and single source cases.
 */
export function generateLede(set: RecordSet): string {
  const context = buildContext(set);

  if (context.total === 0) {
    return scaleSentence(context);
  }
  if (context.total === 1) {
    const only = set.records[0];
    const year = only.date.slice(0, 4);
    return `${context.entity} has one public record, a ${typeLabel(
      only.record_type
    )} from ${sourceLabel(only.source)}${year ? ` dated ${year}` : ""}.`;
  }

  const sentences = [
    scaleSentence(context),
    sourceSentence(context),
    busiestSentence(context),
  ].filter(Boolean);

  return sentences.join(" ");
}
