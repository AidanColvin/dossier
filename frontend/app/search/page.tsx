"use client";

// Search — the pipeline console. Configure a run (entity, ticker, which
// connectors, how many results, how strict the verification threshold is),
// fire it, and read the resulting dossier profile.

import Link from "next/link";
import { useState } from "react";
import { countBy, summarize } from "@/lib/analytics";
import { sourceLabel, typeLabel } from "@/lib/format";
import { SOURCES, sourceColor } from "@/lib/sources";
import { useEnsureRun } from "@/lib/store";
import type { RunRequest } from "@/lib/types";
import {
  BarChart,
  Empty,
  LoadingRows,
  ModeNotice,
  PageHead,
  RecordRow,
  SourceChip,
  Stat,
} from "@/components/ui";

// A few entities the bundled sample dataset covers, offered as one-click
// starting points so the page is useful before the visitor types anything.
const SUGGESTIONS = [
  "NVIDIA",
  "Moderna",
  "Pfizer",
  "Alphabet",
  "Eli Lilly",
  "Regeneron",
];

export default function SearchPage() {
  const { run, loading, error, execute, loadDemo, addToCompare } =
    useEnsureRun();

  const [entity, setEntity] = useState("");
  const [ticker, setTicker] = useState("");
  const [selected, setSelected] = useState<string[]>(
    SOURCES.map((source) => source.key)
  );
  const [maxResults, setMaxResults] = useState(10);
  const [minSources, setMinSources] = useState(1);

  const response = run?.response ?? null;
  const stats = summarize(response);

  // takes: a source key
  // does: toggles it in the selection, but refuses to empty the set — a run
  //       with zero connectors would just return nothing
  function toggleSource(key: string) {
    setSelected((current) =>
      current.includes(key)
        ? current.length > 1
          ? current.filter((item) => item !== key)
          : current
        : [...current, key]
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const name = entity.trim();
    if (!name) return;
    const request: RunRequest = {
      entity: name,
      ticker: ticker.trim() || undefined,
      sources: selected.length === SOURCES.length ? null : selected,
      max_results: maxResults,
      min_sources: minSources,
    };
    void execute(request);
  }

  return (
    <main className="page">
      <PageHead title="Search">
        Runs the extract → transform → load pipeline across the selected
        connectors and returns one normalized, deduplicated record set.
      </PageHead>

      <form className="card" onSubmit={submit} style={{ marginBottom: 28 }}>
        <div
          className="grid"
          style={{ gridTemplateColumns: "2fr 1fr", marginBottom: 18 }}
        >
          <div className="field">
            <label className="field__label" htmlFor="entity">
              Company or organization
            </label>
            <input
              id="entity"
              className="input"
              value={entity}
              onChange={(event) => setEntity(event.target.value)}
              placeholder="NVIDIA"
              autoComplete="organization"
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="ticker">
              Ticker <span style={{ fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              id="ticker"
              className="input"
              value={ticker}
              onChange={(event) => setTicker(event.target.value)}
              placeholder="NVDA"
              style={{ textTransform: "uppercase" }}
            />
          </div>
        </div>

        <div className="field" style={{ marginBottom: 18 }}>
          <span className="field__label">Sources</span>
          <div className="row">
            {SOURCES.map((source) => (
              <SourceChip
                key={source.key}
                source={source.key}
                active={selected.includes(source.key)}
                onClick={() => toggleSource(source.key)}
              />
            ))}
          </div>
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 18 }}
        >
          <div className="field">
            <label className="field__label" htmlFor="max-results">
              Results per source
            </label>
            <select
              id="max-results"
              className="select"
              value={maxResults}
              onChange={(event) => setMaxResults(Number(event.target.value))}
            >
              {[5, 10, 20, 30, 50].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="min-sources">
              Provenance URLs required to mark a record verified
            </label>
            <select
              id="min-sources"
              className="select"
              value={minSources}
              onChange={(event) => setMinSources(Number(event.target.value))}
            >
              {[1, 2, 3].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || !entity.trim()}
          >
            {loading ? "Running…" : "Run pipeline"}
          </button>
          <span className="spacer" />
          <span style={{ fontSize: 12.5, color: "var(--faint)" }}>
            Or load a sample:
          </span>
          {SUGGESTIONS.map((name) => (
            <button
              key={name}
              type="button"
              className="btn btn--sm"
              disabled={loading}
              onClick={() => {
                setEntity(name);
                void loadDemo(name);
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </form>

      {error && <p className="notice notice--error">{error}</p>}

      <div className="stack">
        <ModeNotice run={run} />

        {loading && !response && <LoadingRows rows={6} />}

        {response && (
          <>
            <section>
              <div className="row" style={{ marginBottom: 14 }}>
                <h2 className="section-title" style={{ margin: 0 }}>
                  {response.entity}
                </h2>
                <span className="spacer" />
                {run && (
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => addToCompare(run)}
                  >
                    Add to compare
                  </button>
                )}
                <Link href="/exports" className="btn btn--sm">
                  Export
                </Link>
              </div>
              <div className="grid grid--4">
                <Stat label="Records" value={stats.total} />
                <Stat
                  label="Verified"
                  value={`${stats.verifiedPct}%`}
                  tone={stats.verifiedPct >= 80 ? "pos" : "warn"}
                />
                <Stat
                  label="Sources up"
                  value={`${stats.sourcesOk}/${stats.sourcesTotal}`}
                  tone={stats.failed.length ? "warn" : "pos"}
                />
                <Stat
                  label="Date range"
                  value={
                    stats.oldest
                      ? `${stats.oldest.slice(0, 4)}–${stats.newest.slice(0, 4)}`
                      : "—"
                  }
                />
              </div>
            </section>

            <section>
              <h2 className="section-title">Record mix</h2>
              <div className="grid grid--2">
                <div className="card">
                  <div className="section-title">By source</div>
                  <BarChart
                    buckets={countBy(response.records, (r) => r.source)}
                    label={sourceLabel}
                    color={sourceColor}
                  />
                </div>
                <div className="card">
                  <div className="section-title">By type</div>
                  <BarChart
                    buckets={countBy(response.records, (r) => r.record_type)}
                    label={typeLabel}
                  />
                </div>
              </div>
            </section>

            <section>
              <div className="row" style={{ marginBottom: 14 }}>
                <h2 className="section-title" style={{ margin: 0 }}>
                  Records
                </h2>
                <span className="spacer" />
                <Link href="/records" style={{ fontSize: 13.5 }}>
                  Open the explorer →
                </Link>
              </div>
              {response.records.length === 0 ? (
                <Empty>No records matched this entity.</Empty>
              ) : (
                <div className="card card--flush">
                  {response.records.slice(0, 12).map((record) => (
                    <RecordRow
                      key={`${record.source}:${record.native_id}`}
                      record={record}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
