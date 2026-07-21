"use client";

// Home — the product. One headline, one search field, then results.
//
// Deliberately not a dashboard: no coverage charts, no stat tiles, no status
// banners. A visitor arrives wanting records for a company, so the only thing
// above the fold is the field that gets them there. Depth lives on the other
// routes for people who go looking for it.

import { useCallback, useMemo, useState } from "react";
import { formatDate, sourceLabel, typeLabel } from "@/lib/format";
import { useEnsureRun } from "@/lib/store";
import type { PipelineRecord } from "@/lib/types";

const SUGGESTIONS = ["Apple", "NVIDIA", "Pfizer", "Moderna", "Tesla"];

// The result-type tabs, in the order they read most naturally. "all" is
// synthesised; the rest map onto record_type values.
const TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "filing", label: "Filings" },
  { key: "paper", label: "Research" },
  { key: "trial", label: "Trials" },
  { key: "grant", label: "Grants" },
];

export default function HomePage() {
  const { run, loading, error, execute } = useEnsureRun();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");

  const records = useMemo(() => run?.response.records ?? [], [run]);

  const submit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const entity = query.trim();
      if (!entity) return;
      setTab("all");
      void execute({ entity, max_results: 10 });
    },
    [query, execute]
  );

  const pick = useCallback(
    (entity: string) => {
      setQuery(entity);
      setTab("all");
      void execute({ entity, max_results: 10 });
    },
    [execute]
  );

  // Only offer a tab when it actually holds something — an empty "Trials" tab
  // is a dead end the visitor has to discover by clicking.
  const counts = useMemo(() => {
    const totals: Record<string, number> = { all: records.length };
    for (const record of records) {
      totals[record.record_type] = (totals[record.record_type] ?? 0) + 1;
    }
    return totals;
  }, [records]);

  const visible = useMemo(
    () =>
      [...(tab === "all"
        ? records
        : records.filter((record) => record.record_type === tab))].sort((a, b) =>
        b.date.localeCompare(a.date)
      ),
    [records, tab]
  );

  return (
    <main className="page">
      <section className="hero">
        <h1>Every public record, in one place.</h1>
        <p>Search a company. See its filings, research, trials, and grants.</p>

        <form onSubmit={submit}>
          <div className="search-bar">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a company or organization"
              aria-label="Search a company or organization"
              autoComplete="organization"
              autoFocus
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading || !query.trim()}
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>
        </form>

        <div className="suggestions">
          {SUGGESTIONS.map((name) => (
            <button key={name} type="button" onClick={() => pick(name)}>
              {name}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p className="notice notice--error" style={{ marginTop: 32 }}>
          {error}
        </p>
      )}

      {loading && (
        <p className="count-line" aria-live="polite">
          Running the pipeline across four sources…
        </p>
      )}

      {!loading && run && (
        <>
          <p className="count-line">
            <strong style={{ color: "var(--ink)" }}>{records.length}</strong>{" "}
            {records.length === 1 ? "record" : "records"} for{" "}
            <strong style={{ color: "var(--ink)" }}>{run.response.entity}</strong>
          </p>

          {records.length > 0 && (
            <div className="tabs">
              {TABS.filter((item) => counts[item.key]).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  data-active={tab === item.key}
                  onClick={() => setTab(item.key)}
                >
                  {item.label} {counts[item.key]}
                </button>
              ))}
            </div>
          )}

          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            {visible.length === 0 ? (
              <p className="empty">
                No records found for {run.response.entity}. Try the full company
                name, or another organization.
              </p>
            ) : (
              visible.map((record) => (
                <Result
                  key={`${record.source}:${record.native_id}`}
                  record={record}
                />
              ))
            )}
          </div>
        </>
      )}
    </main>
  );
}

// takes: one normalized record
// does: renders it as a title plus a single quiet provenance line — the two
//       things a reader needs to judge and open it. Everything else about the
//       record is available on the Records route.
// returns: the result row
function Result({ record }: { record: PipelineRecord }) {
  const venue =
    typeof record.extra?.journal === "string"
      ? record.extra.journal
      : typeof record.extra?.organization === "string"
        ? record.extra.organization
        : "";

  return (
    <div className="result">
      <span className="result__date">{formatDate(record.date)}</span>
      <div className="result__title">
        {record.url ? (
          <a href={record.url} target="_blank" rel="noopener noreferrer">
            {record.title}
          </a>
        ) : (
          record.title
        )}
      </div>
      <div className="result__meta">
        {sourceLabel(record.source)}
        {venue ? ` · ${venue}` : ` · ${typeLabel(record.record_type)}`}
      </div>
    </div>
  );
}
