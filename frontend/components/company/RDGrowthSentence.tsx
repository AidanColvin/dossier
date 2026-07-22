"use client";

// One sentence replacing the two financial charts. If the shape of the trend
// matters, the four financial cards already show it; the growth is better said
// in a line than drawn in a chart with no axis labels.

import { money } from "@/components/Charts";

/**
 * Takes a metric label and a year-to-value series. Returns a one-line growth
 * sentence, or null when fewer than two years exist.
 */
export function RDGrowthSentence({
  label,
  series,
}: {
  label: string;
  series?: Record<string, number>;
}) {
  if (!series) return null;
  const years = Object.keys(series).sort();
  if (years.length < 2) return null;

  const first = years[0];
  const last = years[years.length - 1];
  const from = series[first];
  const to = series[last];
  if (!from) return null;

  const pct = Math.round(((to - from) / Math.abs(from)) * 100);
  const direction = pct >= 0 ? "grew" : "fell";

  return (
    <p className="rd-sentence">
      {label} {direction} {Math.abs(pct)}%, from {money(from)} in {first} to{" "}
      {money(to)} in {last}.
    </p>
  );
}
