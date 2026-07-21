"use client";

// Sources — per-connector health and coverage. What each connector is, what
// it returned on the last run, and what it contributed to the dossier. When a
// connector fails, this is the page that says why.

import { countBy, summarize } from "@/lib/analytics";
import { sourceLabel, typeLabel } from "@/lib/format";
import { SOURCES, sourceColor, sourceMeta } from "@/lib/sources";
import { useEnsureRun } from "@/lib/store";
import type { SourceStatus } from "@/lib/types";
import { BarChart, ModeNotice, PageHead, Stat } from "@/components/ui";

export default function SourcesPage() {
  const { run } = useEnsureRun();
  const response = run?.response ?? null;
  const stats = summarize(response);
  const records = response?.records ?? [];

  // Index the last run's status by connector so a source with no entry at all
  // (never requested) is distinguishable from one that ran and returned zero.
  const statusByKey = new Map<string, SourceStatus>(
    (response?.sources ?? []).map((status) => [status.source, status])
  );

  return (
    <main className="page">
      <PageHead title="Sources">
        Four public APIs, none of which require a key. Each connector extracts
        from its own endpoint, then the pipeline normalizes every result into
        the same record shape before deduplicating across them.
      </PageHead>

      <div className="stack">
        <ModeNotice run={run} />

        <section>
          <div className="grid grid--3">
            <Stat
              label="Connectors"
              value={SOURCES.length}
              hint="all keyless"
            />
            <Stat
              label="Responded"
              value={`${stats.sourcesOk}/${stats.sourcesTotal || SOURCES.length}`}
              tone={stats.failed.length ? "warn" : "pos"}
              hint={stats.failed.length ? "one or more failed" : "no failures"}
            />
            <Stat
              label="Records contributed"
              value={stats.total}
              hint={`${stats.provenanceLinks} provenance URLs`}
            />
          </div>
        </section>

        <section>
          <h2 className="section-title">Contribution to this dossier</h2>
          <div className="card">
            <BarChart
              buckets={countBy(records, (record) => record.source)}
              label={sourceLabel}
              color={sourceColor}
              emptyText="No dossier loaded."
            />
          </div>
        </section>

        <section>
          <h2 className="section-title">Connectors</h2>
          <div className="stack" style={{ gap: 14 }}>
            {SOURCES.map((source) => {
              const status = statusByKey.get(source.key);
              const contributed = records.filter(
                (record) => record.source === source.key
              );
              const types = countBy(contributed, (record) => record.record_type);

              return (
                <div className="card" key={source.key}>
                  <div className="row" style={{ marginBottom: 10 }}>
                    <span
                      className="chip__dot"
                      style={{
                        background: sourceColor(source.key),
                        width: 10,
                        height: 10,
                      }}
                    />
                    <strong style={{ fontSize: 15.5 }}>{source.label}</strong>
                    <span className="badge badge--neutral">{source.yields}</span>
                    {source.keyless && (
                      <span className="badge badge--neutral">no API key</span>
                    )}
                    <span className="spacer" />
                    <StatusBadge status={status} />
                  </div>

                  <p
                    style={{
                      margin: "0 0 12px",
                      color: "var(--muted)",
                      fontSize: 13.5,
                      maxWidth: "70ch",
                    }}
                  >
                    {source.blurb}
                  </p>

                  {status && !status.ok && status.error && (
                    <p className="notice notice--error" style={{ marginBottom: 12 }}>
                      {status.error}
                    </p>
                  )}

                  <div
                    className="row"
                    style={{ fontSize: 12.5, color: "var(--faint)" }}
                  >
                    <span className="mono">{source.endpoint}</span>
                    {types.length > 0 && (
                      <>
                        <span>·</span>
                        <span>
                          {types
                            .map(
                              (bucket) =>
                                `${bucket.count} ${typeLabel(bucket.key).toLowerCase()}`
                            )
                            .join(", ")}
                        </span>
                      </>
                    )}
                    <span className="spacer" />
                    <a href={source.home} target="_blank" rel="noopener noreferrer">
                      {new URL(source.home).host} ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="section-title">How verification works</h2>
          <div className="card">
            <p style={{ margin: "0 0 10px", fontSize: 13.5, color: "var(--muted)" }}>
              Each record carries the list of URLs that attest to it. A record is
              marked <strong>verified</strong> when that list holds at least{" "}
              <code className="mono">min_sources</code> distinct URLs — the
              threshold you set on the Search page. Records below the threshold
              are kept and labelled <strong>unverified</strong> rather than
              dropped, so nothing disappears silently.
            </p>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--muted)" }}>
              Deduplication runs before verification: records matching on
              normalized title and identifier are merged, and their provenance
              lists are unioned, which is how a record can end up backed by more
              sources than the one connector that found it.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

// takes: the connector's status from the last run, if it ran at all
// does: renders the ok / failed / not-run badge
// returns: the badge element
function StatusBadge({ status }: { status?: SourceStatus }) {
  if (!status) {
    return <span className="badge badge--neutral">not run</span>;
  }
  if (!status.ok) {
    return <span className="badge badge--fail">failed</span>;
  }
  if (status.count === 0) {
    return <span className="badge badge--warn">0 records</span>;
  }
  return <span className="badge badge--ok">{status.count} records</span>;
}
