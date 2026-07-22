"use client";

// The "what's new" module. Shows up to three of the most recent records. If
// three or more fall in the last 90 days it is titled "This quarter"; if not
// it falls back to the three most recent overall and is titled "Latest
// activity", so recency is never fabricated.

import { useMemo } from "react";
import { formatDate, sourceLabel, typeLabel } from "@/lib/format";
import type { PipelineRecord } from "@/lib/types";

const QUARTER_DAYS = 90;
const MAX_CARDS = 3;

/** Takes an ISO date. Returns whole days from then until now, or Infinity. */
function daysAgo(date: string): number {
  const then = Date.parse(date);
  if (Number.isNaN(then)) return Infinity;
  return (Date.now() - then) / 86_400_000;
}

/** Takes records. Returns the newest few plus whether they are recent. */
function pickRecent(records: PipelineRecord[]): {
  cards: PipelineRecord[];
  recent: boolean;
} {
  const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const withinQuarter = sorted.filter(
    (record) => daysAgo(record.date) <= QUARTER_DAYS
  );
  const recent = withinQuarter.length >= MAX_CARDS;
  return {
    cards: (recent ? withinQuarter : sorted).slice(0, MAX_CARDS),
    recent,
  };
}

/** Takes records. Returns the recent-activity strip, or nothing when empty. */
export function WhatsNew({ records }: { records: PipelineRecord[] }) {
  const { cards, recent } = useMemo(() => pickRecent(records), [records]);
  if (cards.length === 0) return null;

  return (
    <section className="whats-new">
      <h2 className="section-title">{recent ? "This quarter" : "Latest activity"}</h2>
      <div className="whats-new__row">
        {cards.map((record) => (
          <a
            key={`${record.source}:${record.native_id}`}
            className="whats-new__card"
            href={record.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="whats-new__top">
              <span className="pill pill--source">{sourceLabel(record.source)}</span>
              <span className="whats-new__type">{typeLabel(record.record_type)}</span>
            </div>
            <div className="whats-new__title">{record.title}</div>
            <div className="whats-new__date">{formatDate(record.date)}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
