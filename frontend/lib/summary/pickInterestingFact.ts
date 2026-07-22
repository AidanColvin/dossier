// Picks the one distinctive fact about a record set, so six companies read as
// six findings rather than six templates. Editorial voice comes from choosing
// the interesting thing, not the biggest count. Pure and deterministic.

import type { PipelineRecord } from "@/lib/types";
import type { LedeContext } from "./types";
import { buildContext } from "./generateLede";
import { plural, sourceLabel, typeLabel } from "./templates";

/** Takes a record. Returns its four digit year, or null. */
function yearOf(record: PipelineRecord): number | null {
  const year = Number(record.date.slice(0, 4));
  return Number.isFinite(year) && year > 1900 ? year : null;
}

/**
 * Takes a record set. Returns the share of its records in the busiest year, as
 * a fraction from 0 to 1, or 0 when nothing is dated.
 */
function busiestYearShare(context: LedeContext): number {
  if (!context.busiestYear || context.total === 0) return 0;
  return context.busiestYear.count / context.total;
}

/**
 * Takes a record set. Returns one distinctive sentence about it. The priority
 * order is what makes companies sound different: a source that dominates is
 * more telling than a source that merely leads, a run of years concentrated in
 * one is a story, a long span is a story, and only when nothing stands out
 * does it fall back to the leading record type.
 */
export function pickInterestingFact(set: {
  entity: string;
  records: PipelineRecord[];
}): string {
  const context = buildContext(set);
  const { total, sources, firstYear, lastYear, busiestYear } = context;

  if (total === 0) return "";
  if (total === 1) {
    return `Its single record is a ${typeLabel(
      set.records[0].record_type
    )} from ${sourceLabel(set.records[0].source)}.`;
  }

  const top = sources[0];
  const topShare = top ? top.count / total : 0;

  // A source that carries most of the output is the real story. "40% NIH
  // grants" tells you what kind of company this is; "led by filings" does not.
  if (top && topShare >= 0.45 && sources.length > 1) {
    const pct = Math.round(topShare * 100);
    return `${pct}% of that is ${describeSource(top.source)}.`;
  }

  // A balanced spread across all four sources is itself distinctive: the
  // company shows up everywhere. Name its two most active registers rather
  // than a fixed list, so two even companies still read differently.
  if (sources.length >= 4 && topShare <= 0.4) {
    const [a, b] = sources;
    return `It shows up across all four sources, most in ${describeSource(
      a.source
    )} and ${describeSource(b.source)}.`;
  }

  // Activity concentrated in a single recent year reads as momentum.
  if (busiestYear && busiestYearShare(context) >= 0.4 && busiestYear.count >= 3) {
    const pct = Math.round(busiestYearShare(context) * 100);
    return `${pct}% of it lands in ${busiestYear.year} alone.`;
  }

  // A long history is a story of its own.
  if (firstYear !== null && lastYear !== null && lastYear - firstYear >= 15) {
    return `The record runs back to ${firstYear}, a span of ${
      lastYear - firstYear
    } years.`;
  }

  // Two sources close in count means a genuine dual focus.
  if (sources.length >= 2) {
    const [a, b] = sources;
    if (b.count > 0 && a.count / b.count <= 1.5) {
      return `It is split between ${describeSource(a.source)} and ${describeSource(
        b.source
      )}.`;
    }
  }

  // Fallback: name the leading source plainly, once nothing sharper applies.
  if (top) {
    return `Most of it is ${describeSource(top.source)}.`;
  }
  return "";
}

/**
 * Takes a source key. Returns a noun phrase describing what it contributes,
 * for use mid-sentence ("NIH grants", "clinical trials").
 */
function describeSource(source: string): string {
  const phrases: Record<string, string> = {
    sec_edgar: "SEC filings",
    openalex: "research papers",
    clinicaltrials: "clinical trials",
    nih_reporter: "NIH grants",
  };
  return phrases[source] ?? plural(2, typeLabel(source));
}
