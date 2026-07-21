"use client";

// Compare — how two or three organizations differ in what they actually
// produce: filings, research, trials, grants.
//
// Deliberately narrow. Earlier this page led with verification rate, sources
// responding, provenance URL counts and date ranges — pipeline diagnostics,
// not answers. Nobody comparing Pfizer to Moderna wants to know how many URLs
// backed a record. What they want is the shape of each organization's output,
// so that is the only thing here.

import { useCallback, useState } from "react";
import { fetchDemo } from "@/lib/api";
import { typeLabel } from "@/lib/format";
import { useRun } from "@/lib/store";
import type { RunResult } from "@/lib/types";

// The four categories every dossier is made of, in a fixed order so the
// columns line up between organizations even when one has none of a kind.
const CATEGORIES = ["filing", "paper", "trial", "grant"] as const;

export default function ComparePage() {
  const { compare, addToCompare, removeFromCompare } = useRun();
  const [entity, setEntity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const name = entity.trim();
      if (!name) return;
      setBusy(true);
      setError(null);
      try {
        const { response, mode } = await fetchDemo(name);
        addToCompare({
          response,
          mode,
          ranAt: Date.now(),
          request: { entity: name },
        });
        setEntity("");
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [entity, addToCompare]
  );

  // One shared scale across every column, so a taller bar always means more
  // records — comparing per-column maxima would make a company with 3 trials
  // look equal to one with 30.
  const peak = Math.max(
    1,
    ...compare.flatMap((item) =>
      CATEGORIES.map(
        (category) =>
          item.response.records.filter((r) => r.record_type === category).length
      )
    )
  );

  return (
    <main className="page">
      <div className="page-head" style={{ textAlign: "center" }}>
        <h1>Compare</h1>
        <p style={{ margin: "0 auto" }}>
          What each organization actually produces, side by side.
        </p>
      </div>

      <form
        onSubmit={add}
        style={{ maxWidth: 520, margin: "0 auto 44px" }}
      >
        <div className="search-bar">
          <input
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            placeholder="Add an organization"
            aria-label="Add an organization to compare"
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={busy || !entity.trim()}
          >
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
        {error && (
          <p className="notice notice--error" style={{ marginTop: 14 }}>
            {error}
          </p>
        )}
      </form>

      {compare.length === 0 ? (
        <p className="empty">
          Add two or more organizations to see how their output compares.
        </p>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))`,
            maxWidth: 900,
            margin: "0 auto",
            alignItems: "start",
          }}
        >
          {compare.map((item) => (
            <Column
              key={item.response.entity}
              item={item}
              peak={peak}
              onRemove={() => removeFromCompare(item.response.entity)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

// takes: one compared dossier, the shared bar scale, and a remove handler
// does: renders the organization's name, total, and one bar per category
// returns: a single comparison column
function Column({
  item,
  peak,
  onRemove,
}: {
  item: RunResult;
  peak: number;
  onRemove: () => void;
}) {
  const { entity, records } = {
    entity: item.response.entity,
    records: item.response.records,
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginBottom: 4,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 19,
            fontWeight: 600,
            letterSpacing: "-0.02em",
          }}
        >
          {entity}
        </h2>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${entity}`}
          style={{
            border: "none",
            background: "none",
            color: "var(--ghost)",
            cursor: "pointer",
            fontSize: 15,
            lineHeight: 1,
            padding: 2,
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 20 }}
      >
        {records.length} total records
      </div>

      <div className="bars">
        {CATEGORIES.map((category) => {
          const count = records.filter(
            (record) => record.record_type === category
          ).length;
          return (
            <div key={category}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13.5,
                  marginBottom: 6,
                  color: count ? "var(--ink)" : "var(--ghost)",
                }}
              >
                <span>{typeLabel(category)}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {count}
                </span>
              </div>
              <div className="bar-row__track">
                <div
                  className="bar-row__fill"
                  style={{
                    width: `${(count / peak) * 100}%`,
                    background: "var(--ink)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
