"use client";

// the small shared surfaces every view composes from: page headers, stat
// tiles, bar charts, record rows and the demo/live banner. keeping them here
// means the Records table and the Compare table can never drift apart.

import Link from "next/link";
import type { ReactNode } from "react";
import type { Bucket } from "@/lib/analytics";
import { provenanceCount } from "@/lib/analytics";
import { formatDate, recordChips, sourceLabel, typeLabel } from "@/lib/format";
import { sourceColor } from "@/lib/sources";
import type { PipelineRecord, RunResult } from "@/lib/types";

export function PageHead({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{title}</h1>
          {children && <p>{children}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "pos" | "warn" | "neg";
}) {
  const color =
    tone === "pos"
      ? "var(--pos)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "neg"
          ? "var(--neg)"
          : undefined;
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value" style={{ color }}>
        {value}
      </div>
      {hint && <div className="stat__hint">{hint}</div>}
    </div>
  );
}

/**
 * given labelled buckets and a colour resolver
 * render a horizontal bar chart scaled to the largest bucket — pure CSS, so
 * there is no charting dependency to ship or theme
 */
export function BarChart({
  buckets,
  color = () => "var(--accent)",
  label = (key: string) => key,
  emptyText = "No data.",
}: {
  buckets: Bucket[];
  color?: (key: string) => string;
  label?: (key: string) => string;
  emptyText?: string;
}) {
  if (buckets.length === 0) {
    return <p className="empty">{emptyText}</p>;
  }
  // Guard the divisor: an all-zero set would otherwise produce NaN widths.
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));

  return (
    <div className="bars">
      {buckets.map((bucket) => (
        <div className="bar-row" key={bucket.key}>
          <div className="bar-row__label" title={label(bucket.key)}>
            {label(bucket.key)}
          </div>
          <div className="bar-row__track">
            <div
              className="bar-row__fill"
              style={{
                width: `${(bucket.count / max) * 100}%`,
                background: color(bucket.key),
              }}
            />
          </div>
          <div className="bar-row__value">{bucket.count}</div>
        </div>
      ))}
    </div>
  );
}

export function SourceChip({
  source,
  active,
  onClick,
  count,
}: {
  source: string;
  active?: boolean;
  onClick?: () => void;
  count?: number;
}) {
  const content = (
    <>
      <span className="chip__dot" style={{ background: sourceColor(source) }} />
      {sourceLabel(source)}
      {count != null && (
        <span style={{ color: "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
          {count}
        </span>
      )}
    </>
  );

  if (!onClick) {
    return <span className="chip chip--static">{content}</span>;
  }
  return (
    <button
      type="button"
      className="chip"
      data-active={active}
      aria-pressed={active}
      onClick={onClick}
    >
      {content}
    </button>
  );
}

/**
 * given one normalized record
 * render its row: a source-coloured rail, the linked title, and the metadata
 * strip carrying date, type, provenance count and verification state
 */
export function RecordRow({ record }: { record: PipelineRecord }) {
  const provenance = provenanceCount(record);
  return (
    <div className="record">
      <div
        className="record__rail"
        style={{ background: sourceColor(record.source) }}
        aria-hidden
      />
      <div className="record__body">
        <div className="record__title">
          {record.url ? (
            <a href={record.url} target="_blank" rel="noopener noreferrer">
              {record.title}
            </a>
          ) : (
            record.title
          )}
        </div>
        <div className="record__meta">
          <span>{sourceLabel(record.source)}</span>
          <span className="record__dot">·</span>
          <span>{typeLabel(record.record_type)}</span>
          <span className="record__dot">·</span>
          <span>{formatDate(record.date)}</span>
          {recordChips(record).map((chip) => (
            <span className="badge badge--neutral" key={chip}>
              {chip}
            </span>
          ))}
          <span
            className={`badge ${record.verified ? "badge--ok" : "badge--warn"}`}
            title={`${provenance} provenance URL${provenance === 1 ? "" : "s"}`}
          >
            {record.verified ? "verified" : "unverified"} · {provenance} src
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * given the active run
 * render the banner explaining whether the numbers on screen came from the
 * live pipeline or the bundled sample — shown on every data view so a demo
 * result is never mistaken for a real one
 */
export function ModeNotice({ run }: { run: RunResult | null }) {
  if (!run) return null;
  if (run.mode === "live") {
    return (
      <p className="notice notice--info">
        Live pipeline run for <strong>{run.response.entity}</strong> — every
        record was fetched from its upstream API and provenance-checked.
      </p>
    );
  }
  return (
    <p className="notice notice--warn">
      Showing <strong>bundled sample data</strong> for {run.response.entity}.
      These records are illustrative, not a live API result. Connect the
      pipeline backend (see <Link href="/pipeline">Pipeline</Link>) to run
      against the real sources.
    </p>
  );
}

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="stack" style={{ gap: 10 }} aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton" style={{ height: 56 }} />
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
