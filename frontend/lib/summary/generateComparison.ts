// The comparison generator. Takes two record sets and returns a two to three
// sentence finding contrasting them. Pure and deterministic, like the lede: no
// randomness, no network, no language model.

import { buildContext } from "./generateLede";
import type { RecordSet } from "./types";
import { sourceLabel } from "./templates";

/** Takes two integers. Returns the percent difference of a over b, rounded. */
function percentMore(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : 100;
  return Math.round(((a - b) / b) * 100);
}

/**
 * Takes two record sets. Returns a finding sentence contrasting their totals,
 * source mix, and activity. Handles equal counts, one side dominant, no
 * overlap in sources, and either side empty.
 */
export function generateComparison(leftSet: RecordSet, rightSet: RecordSet): string {
  const left = buildContext(leftSet);
  const right = buildContext(rightSet);
  const ln = left.entity;
  const rn = right.entity;

  if (left.total === 0 && right.total === 0) {
    return `Neither ${ln} nor ${rn} has any public records across the four sources searched.`;
  }
  if (left.total === 0) {
    return `${rn} has ${right.total} public records; ${ln} has none across the four sources searched.`;
  }
  if (right.total === 0) {
    return `${ln} has ${left.total} public records; ${rn} has none across the four sources searched.`;
  }

  const sentences: string[] = [];

  // Sentence one: the headline count comparison.
  if (left.total === right.total) {
    sentences.push(`${ln} and ${rn} each have ${left.total} records.`);
  } else {
    const [more, fewer] =
      left.total > right.total ? [left, right] : [right, left];
    sentences.push(
      `${more.entity} has ${more.total} records to ${fewer.entity}'s ${fewer.total}.`
    );
  }

  // Sentence two: where their source mix differs most, by record type.
  const diff = sourceDifference(left, right);
  if (diff) sentences.push(diff);

  // Sentence three: their busiest years, whether shared or not.
  if (left.busiestYear && right.busiestYear) {
    if (left.busiestYear.year === right.busiestYear.year) {
      sentences.push(
        `Both companies are most active in ${left.busiestYear.year}.`
      );
    } else {
      sentences.push(
        `${ln} peaks in ${left.busiestYear.year}, ${rn} in ${right.busiestYear.year}.`
      );
    }
  }

  return sentences.join(" ");
}

/**
 * Takes two contexts. Returns a sentence about the source where their output
 * diverges most, or an empty string when there is nothing notable to say.
 */
function sourceDifference(
  left: ReturnType<typeof buildContext>,
  right: ReturnType<typeof buildContext>
): string {
  const keys = new Set([
    ...left.sources.map((s) => s.source),
    ...right.sources.map((s) => s.source),
  ]);

  const count = (
    ctx: ReturnType<typeof buildContext>,
    source: string
  ): number => ctx.sources.find((s) => s.source === source)?.count ?? 0;

  let widest = "";
  let widestGap = 0;
  for (const source of keys) {
    const gap = Math.abs(count(left, source) - count(right, source));
    if (gap > widestGap) {
      widestGap = gap;
      widest = source;
    }
  }
  if (!widest || widestGap === 0) return "";

  const l = count(left, widest);
  const r = count(right, widest);
  const [more, fewer, moreName] =
    l >= r ? [l, r, left.entity] : [r, l, right.entity];
  const label = sourceLabel(widest);

  if (fewer === 0) {
    return `${moreName} has ${more} records on ${label}; the other has none.`;
  }
  const pct = percentMore(more, fewer);
  return `${moreName} has ${pct}% more records on ${label}.`;
}
