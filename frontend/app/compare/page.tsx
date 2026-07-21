"use client";

// Compare — several dossiers side by side. Entities are added from the Search
// page (or loaded here directly) and held in the shared store, so the tray
// survives navigating away and back.

import Link from "next/link";
import { useState } from "react";
import { fetchDemo } from "@/lib/api";
import { countBy, summarize } from "@/lib/analytics";
import { sourceLabel, typeLabel } from "@/lib/format";
import { SOURCES, sourceColor } from "@/lib/sources";
import { useRun } from "@/lib/store";
import { Empty, PageHead } from "@/components/ui";

export default function ComparePage() {
  const { compare, addToCompare, removeFromCompare, clearCompare } = useRun();
  const [entity, setEntity] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // takes: nothing (reads the entity input)
  // does: fetches that entity's dossier and drops it straight into the tray.
  //       deliberately bypasses the shared store's `run`, so adding a
  //       comparison does not replace whatever dossier is active on the other
  //       pages.
  async function addEntity(event: React.FormEvent) {
    event.preventDefault();
    const name = entity.trim();
    if (!name) return;
    setAdding(true);
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
      setAdding(false);
    }
  }

  // Every record type present across all compared entities, so the rows line
  // up even when one entity has no trials and another does.
  const allTypes = [
    ...new Set(
      compare.flatMap((item) =>
        item.response.records.map((record) => record.record_type)
      )
    ),
  ].sort();

  return (
    <main className="page page--wide">
      <PageHead
        title="Compare"
        actions={
          compare.length > 0 ? (
            <button type="button" className="btn btn--sm" onClick={clearCompare}>
              Clear all
            </button>
          ) : undefined
        }
      >
        Put up to four dossiers side by side — coverage, verification rate and
        per-source contribution, on the same axes.
      </PageHead>

      <form className="card" onSubmit={addEntity} style={{ marginBottom: 28 }}>
        <div className="row">
          <input
            className="input"
            style={{ flex: 1, minWidth: 220 }}
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            placeholder="Add an entity — Moderna, Pfizer, Alphabet…"
            aria-label="Entity to add to the comparison"
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={adding || !entity.trim()}
          >
            {adding ? "Loading…" : "Add"}
          </button>
        </div>
        {error && (
          <p className="notice notice--error" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--faint)" }}>
          You can also add the active dossier from the{" "}
          <Link href="/search">Search</Link> page.
        </p>
      </form>

      {compare.length === 0 ? (
        <Empty>
          Nothing to compare yet. Add an entity above, or run a search and use
          &ldquo;Add to compare&rdquo;.
        </Empty>
      ) : (
        <div className="stack">
          <section>
            <h2 className="section-title">Side by side</h2>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Metric</th>
                    {compare.map((item) => (
                      <th key={item.response.entity}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span>{item.response.entity}</span>
                          <button
                            type="button"
                            className="btn btn--sm"
                            style={{ padding: "1px 8px", fontSize: 11 }}
                            onClick={() => removeFromCompare(item.response.entity)}
                            aria-label={`Remove ${item.response.entity}`}
                          >
                            ✕
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <Row
                    label="Records"
                    cells={compare.map((item) => String(item.response.count))}
                  />
                  <Row
                    label="Verified"
                    cells={compare.map(
                      (item) => `${summarize(item.response).verifiedPct}%`
                    )}
                  />
                  <Row
                    label="Sources responding"
                    cells={compare.map((item) => {
                      const stats = summarize(item.response);
                      return `${stats.sourcesOk}/${stats.sourcesTotal}`;
                    })}
                  />
                  <Row
                    label="Date range"
                    cells={compare.map((item) => {
                      const stats = summarize(item.response);
                      return stats.oldest
                        ? `${stats.oldest.slice(0, 4)}–${stats.newest.slice(0, 4)}`
                        : "—";
                    })}
                  />
                  <Row
                    label="Provenance URLs"
                    cells={compare.map((item) =>
                      String(summarize(item.response).provenanceLinks)
                    )}
                  />

                  <tr>
                    <td
                      colSpan={compare.length + 1}
                      style={{
                        background: "var(--panel-2)",
                        fontSize: 11.5,
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--faint)",
                      }}
                    >
                      By source
                    </td>
                  </tr>
                  {SOURCES.map((source) => (
                    <tr key={source.key}>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span
                          className="chip__dot"
                          style={{
                            background: sourceColor(source.key),
                            display: "inline-block",
                            marginRight: 7,
                          }}
                        />
                        {source.label}
                      </td>
                      {compare.map((item) => {
                        const n = item.response.records.filter(
                          (record) => record.source === source.key
                        ).length;
                        return (
                          <td
                            key={item.response.entity}
                            style={{
                              fontVariantNumeric: "tabular-nums",
                              color: n ? "var(--ink)" : "var(--ghost)",
                            }}
                          >
                            {n || "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  <tr>
                    <td
                      colSpan={compare.length + 1}
                      style={{
                        background: "var(--panel-2)",
                        fontSize: 11.5,
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--faint)",
                      }}
                    >
                      By type
                    </td>
                  </tr>
                  {allTypes.map((type) => (
                    <tr key={type}>
                      <td style={{ whiteSpace: "nowrap" }}>{typeLabel(type)}</td>
                      {compare.map((item) => {
                        const n = item.response.records.filter(
                          (record) => record.record_type === type
                        ).length;
                        return (
                          <td
                            key={item.response.entity}
                            style={{
                              fontVariantNumeric: "tabular-nums",
                              color: n ? "var(--ink)" : "var(--ghost)",
                            }}
                          >
                            {n || "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="section-title">Coverage profile</h2>
            <div className="grid grid--2">
              {compare.map((item) => {
                const buckets = countBy(
                  item.response.records,
                  (record) => record.source
                );
                const max = Math.max(1, ...buckets.map((b) => b.count));
                return (
                  <div className="card" key={item.response.entity}>
                    <div className="section-title">{item.response.entity}</div>
                    <div className="bars">
                      {buckets.map((bucket) => (
                        <div className="bar-row" key={bucket.key}>
                          <div className="bar-row__label">
                            {sourceLabel(bucket.key)}
                          </div>
                          <div className="bar-row__track">
                            <div
                              className="bar-row__fill"
                              style={{
                                width: `${(bucket.count / max) * 100}%`,
                                background: sourceColor(bucket.key),
                              }}
                            />
                          </div>
                          <div className="bar-row__value">{bucket.count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

// takes: a row label and one cell per compared entity
// does: renders a metric row, dimming the label column like a header
// returns: the table row
function Row({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr>
      <td style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>{label}</td>
      {cells.map((cell, index) => (
        <td
          key={index}
          style={{ fontVariantNumeric: "tabular-nums", fontWeight: 550 }}
        >
          {cell}
        </td>
      ))}
    </tr>
  );
}
