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

/** Takes a dollar amount. Returns it compact: $416.2B, $89.3M, $512,345. */
function compactMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}

/**
 * Takes the entity name and its profile. Returns the money sentence, or ""
 * when the profile has no revenue to report. This is the sentence a reader
 * actually came for: how big the company is, whether it is growing, and
 * whether it makes money, all from its own SEC filings.
 */
export function financeSentence(
  entity: string,
  profile: RecordSet["profile"]
): string {
  const revenue = profile?.financials?.revenue ?? {};
  const years = Object.keys(revenue).sort();
  const latest = years[years.length - 1];
  const value = revenue[latest];
  if (!latest || !value) return "";

  const parts = [`${entity} generated ${compactMoney(value)} in revenue in FY${latest}`];

  const prior = revenue[years[years.length - 2]];
  if (prior) {
    const growth = Math.round(((value - prior) / Math.abs(prior)) * 100);
    if (growth !== 0) {
      parts.push(`${growth > 0 ? "up" : "down"} ${Math.abs(growth)}% year over year`);
    }
  }

  const netIncome = profile?.financials?.net_income?.[latest];
  if (netIncome != null) {
    if (netIncome >= 0) {
      const margin = Math.round((netIncome / value) * 1000) / 10;
      parts.push(`with net income of ${compactMoney(netIncome)} at a ${margin}% net margin`);
    } else {
      parts.push(`with a net loss of ${compactMoney(Math.abs(netIncome))}`);
    }
  }

  return `${parts.join(", ")}.`;
}

/**
 * Takes the profile. Returns the identity sentence naming ticker, exchange,
 * industry, and headquarters, or "" when none of those are known.
 */
export function identitySentence(profile: RecordSet["profile"]): string {
  if (!profile) return "";
  const bits: string[] = [];
  if (profile.ticker && profile.exchange) {
    bits.push(`It trades as ${profile.ticker} on ${profile.exchange}`);
  } else if (profile.ticker) {
    bits.push(`It trades as ${profile.ticker}`);
  }
  if (profile.industry) {
    bits.push(bits.length ? `in ${profile.industry}` : `It operates in ${profile.industry}`);
  }
  if (profile.city && profile.state) {
    bits.push(
      bits.length
        ? `from ${profile.city}, ${profile.state}`
        : `It is headquartered in ${profile.city}, ${profile.state}`
    );
  }
  return bits.length ? `${bits.join(", ")}.` : "";
}

/**
 * Takes a record set. Returns the lede. When the company's own SEC financials
 * are on file, the paragraph opens with them: revenue, growth, and profit are
 * what a reader came to learn, so they come first. Identity follows, and the
 * most recent substantive activity closes the paragraph as context. Without
 * financials (an unresolved or private company), the activity headline is the
 * whole lede, unchanged.
 */
export function generateLede(set: RecordSet): string {
  const finance = financeSentence(set.entity, set.profile);
  const headline = pickHeadline({ entity: set.entity, records: set.records });
  if (!finance) return headline;

  const identity = identitySentence(set.profile);
  return [finance, identity, headline].filter(Boolean).join(" ");
}
