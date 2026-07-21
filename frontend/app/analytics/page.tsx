"use client";

// Analytics — the shape of the dossier. Distribution across sources, record
// types and years, plus the provenance depth histogram that shows how well
// multi-sourced the record set actually is.

import { useMemo } from "react";
import { byYear, countBy, provenanceCount, summarize } from "@/lib/analytics";
import { formatDate, sourceLabel, typeLabel } from "@/lib/format";
import { sourceColor } from "@/lib/sources";
import { useEnsureRun } from "@/lib/store";
import { BarChart, Empty, ModeNotice, PageHead, Stat } from "@/components/ui";

export default function AnalyticsPage() {
  const { run } = useEnsureRun();
  const response = run?.response ?? null;
  const records = response?.records ?? [];
  const stats = summarize(response);

  const bySource = useMemo(
    () => countBy(records, (record) => record.source),
    [records]
  );
  const byType = useMemo(
    () => countBy(records, (record) => record.record_type),
    [records]
  );
  const years = useMemo(() => byYear(records), [records]);

  // How many records are backed by 1, 2, 3+ provenance URLs. Bucketed rather
  // than plotted raw because the tail is long and thin.
  const depth = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of records) {
      const n = provenanceCount(record);
      const key = n >= 3 ? "3+" : String(n);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return ["1", "2", "3+"]
      .filter((key) => counts.has(key))
      .map((key) => ({ key, count: counts.get(key) ?? 0 }));
  }, [records]);

  // The most recent year that actually carries records — a better "freshness"
  // signal than the max date, which one stray record can skew.
  const busiestYear = useMemo(
    () =>
      years.reduce(
        (best, bucket) => (bucket.count > (best?.count ?? 0) ? bucket : best),
        years[0]
      ),
    [years]
  );

  if (records.length === 0) {
    return (
      <main className="page">
        <PageHead title="Analytics">
          Distribution of the loaded dossier across sources, types and time.
        </PageHead>
        <Empty>No dossier loaded yet — run a search first.</Empty>
      </main>
    );
  }

  return (
    <main className="page">
      <PageHead title="Analytics">
        {`How ${response?.entity ?? "this dossier"}'s ${records.length} records distribute across sources, types and time.`}
      </PageHead>

      <div className="stack">
        <ModeNotice run={run} />

        <section>
          <div className="grid grid--4">
            <Stat
              label="Records"
              value={stats.total}
              hint={`${bySource.length} sources · ${byType.length} types`}
            />
            <Stat
              label="Verified"
              value={`${stats.verifiedPct}%`}
              tone={stats.verifiedPct >= 80 ? "pos" : "warn"}
              hint={`${stats.total - stats.verified} below threshold`}
            />
            <Stat
              label="Span"
              value={
                stats.oldest
                  ? `${Number(stats.newest.slice(0, 4)) - Number(stats.oldest.slice(0, 4)) + 1}y`
                  : "—"
              }
              hint={
                stats.oldest
                  ? `${formatDate(stats.oldest)} → ${formatDate(stats.newest)}`
                  : "no dated records"
              }
            />
            <Stat
              label="Busiest year"
              value={busiestYear?.key ?? "—"}
              hint={busiestYear ? `${busiestYear.count} records` : undefined}
            />
          </div>
        </section>

        <section>
          <div className="grid grid--2">
            <div className="card">
              <div className="section-title">Records by source</div>
              <BarChart
                buckets={bySource}
                label={sourceLabel}
                color={sourceColor}
              />
            </div>
            <div className="card">
              <div className="section-title">Records by type</div>
              <BarChart buckets={byType} label={typeLabel} />
            </div>
          </div>
        </section>

        <section>
          <h2 className="section-title">Records by year</h2>
          <div className="card">
            <BarChart
              buckets={years}
              emptyText="No records carry a usable date."
            />
          </div>
        </section>

        <section>
          <h2 className="section-title">Provenance depth</h2>
          <div className="card">
            <p
              style={{
                margin: "0 0 16px",
                fontSize: 13.5,
                color: "var(--muted)",
                maxWidth: "70ch",
              }}
            >
              How many distinct URLs back each record. Deeper is stronger: a
              record attested by three sources survived deduplication across
              three independent endpoints.
            </p>
            <BarChart
              buckets={depth}
              label={(key) => `${key} source${key === "1" ? "" : "s"}`}
              color={(key) =>
                key === "1" ? "var(--warn)" : "var(--pos)"
              }
            />
          </div>
        </section>

        <section>
          <h2 className="section-title">Source × type matrix</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Source</th>
                  {byType.map((bucket) => (
                    <th key={bucket.key}>{typeLabel(bucket.key)}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {bySource.map((source) => {
                  const forSource = records.filter(
                    (record) => record.source === source.key
                  );
                  return (
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
                        {sourceLabel(source.key)}
                      </td>
                      {byType.map((type) => {
                        const n = forSource.filter(
                          (record) => record.record_type === type.key
                        ).length;
                        return (
                          <td
                            key={type.key}
                            style={{
                              fontVariantNumeric: "tabular-nums",
                              color: n ? "var(--ink)" : "var(--ghost)",
                            }}
                          >
                            {n || "—"}
                          </td>
                        );
                      })}
                      <td
                        style={{
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 600,
                        }}
                      >
                        {source.count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
