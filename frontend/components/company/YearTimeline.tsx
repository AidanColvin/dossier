"use client";

// An interactive year timeline. Shows record counts per year as a row of bars
// and lets the reader click a year to filter the record list below. Built as a
// native UI element, not a dashboard widget: no axes, no chart chrome.

import { useMemo } from "react";
import { byYear } from "@/lib/analytics";
import type { PipelineRecord } from "@/lib/types";

/**
 * Takes records, the active year, and a select handler. Returns a clickable
 * strip of per-year bars. Clicking the active year clears the filter.
 */
export function YearTimeline({
  records,
  activeYear,
  onSelect,
}: {
  records: PipelineRecord[];
  activeYear: number | null;
  onSelect: (year: number | null) => void;
}) {
  const buckets = useMemo(() => byYear(records), [records]);
  if (buckets.length < 2) return null;

  const max = Math.max(...buckets.map((bucket) => bucket.count), 1);

  return (
    <section className="timeline" aria-label="Records by year">
      <div className="timeline__row" role="group">
        {buckets.map((bucket) => {
          const year = Number(bucket.key);
          const active = activeYear === year;
          const empty = bucket.count === 0;
          return (
            <button
              key={bucket.key}
              type="button"
              className="timeline__col"
              data-active={active}
              disabled={empty}
              aria-pressed={active}
              aria-label={`${bucket.key}, ${bucket.count} ${
                bucket.count === 1 ? "record" : "records"
              }`}
              title={`${bucket.key}: ${bucket.count}`}
              onClick={() => onSelect(active ? null : year)}
            >
              <span className="timeline__count">{empty ? "" : bucket.count}</span>
              <span
                className="timeline__bar"
                style={{ height: `${empty ? 2 : (bucket.count / max) * 100}%` }}
              />
              <span className="timeline__year">{bucket.key}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
