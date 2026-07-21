"use client";

// Home — the landing dashboard. States what Dossier does, shows the headline
// numbers for whatever dossier is currently loaded, and routes into the
// deeper views.

import Link from "next/link";
import { countBy, summarize } from "@/lib/analytics";
import { sourceLabel } from "@/lib/format";
import { SOURCES, sourceColor } from "@/lib/sources";
import { useEnsureRun } from "@/lib/store";
import {
  BarChart,
  LoadingRows,
  ModeNotice,
  PageHead,
  RecordRow,
  SourceChip,
  Stat,
} from "@/components/ui";

const DESTINATIONS = [
  {
    href: "/search",
    title: "Search",
    blurb: "Compile a dossier on any company or organization.",
  },
  {
    href: "/records",
    title: "Records",
    blurb: "Filter, sort and search every normalized record.",
  },
  {
    href: "/sources",
    title: "Sources",
    blurb: "Per-connector health, coverage and provenance.",
  },
  {
    href: "/analytics",
    title: "Analytics",
    blurb: "Distribution by source, type and year.",
  },
  {
    href: "/compare",
    title: "Compare",
    blurb: "Put several entities side by side.",
  },
  {
    href: "/exports",
    title: "Exports",
    blurb: "Download the dossier as CSV, JSON or Markdown.",
  },
];

export default function HomePage() {
  const { run, loading } = useEnsureRun();
  const response = run?.response ?? null;
  const stats = summarize(response);
  const bySource = countBy(response?.records ?? [], (record) => record.source);

  return (
    <main className="page">
      <PageHead title="Dossier">
        Compiles a sourced intelligence profile of any company or organization
        from four keyless public APIs — extracting, normalizing, deduplicating
        and provenance-checking every record.
      </PageHead>

      <div className="row" style={{ marginBottom: 28 }}>
        {SOURCES.map((source) => (
          <SourceChip key={source.key} source={source.key} />
        ))}
      </div>

      <div className="stack">
        <ModeNotice run={run} />

        <section>
          <h2 className="section-title">
            {response ? `Current dossier — ${response.entity}` : "Current dossier"}
          </h2>
          <div className="grid grid--4">
            <Stat
              label="Records"
              value={stats.total}
              hint={`${stats.types} record types`}
            />
            <Stat
              label="Verified"
              value={`${stats.verifiedPct}%`}
              tone={stats.verifiedPct >= 80 ? "pos" : "warn"}
              hint={`${stats.verified} of ${stats.total} multi-sourced`}
            />
            <Stat
              label="Sources up"
              value={`${stats.sourcesOk}/${stats.sourcesTotal}`}
              tone={stats.failed.length ? "warn" : "pos"}
              hint={
                stats.failed.length
                  ? `${stats.failed.map((s) => sourceLabel(s.source)).join(", ")} failed`
                  : "all connectors responded"
              }
            />
            <Stat
              label="Provenance links"
              value={stats.provenanceLinks}
              hint={
                stats.oldest && stats.newest
                  ? `${stats.oldest.slice(0, 4)}–${stats.newest.slice(0, 4)}`
                  : "no dated records"
              }
            />
          </div>
        </section>

        <section>
          <h2 className="section-title">Coverage by source</h2>
          <div className="card">
            {loading && !response ? (
              <LoadingRows rows={4} />
            ) : (
              <BarChart
                buckets={bySource}
                label={sourceLabel}
                color={sourceColor}
                emptyText="Run a search to populate coverage."
              />
            )}
          </div>
        </section>

        <section>
          <h2 className="section-title">Latest records</h2>
          {loading && !response ? (
            <LoadingRows />
          ) : (
            <div className="card card--flush">
              {[...(response?.records ?? [])]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)
                .map((record) => (
                  <RecordRow key={`${record.source}:${record.native_id}`} record={record} />
                ))}
            </div>
          )}
          {response && response.records.length > 5 && (
            <p style={{ marginTop: 12, fontSize: 13.5 }}>
              <Link href="/records">
                View all {response.count} records →
              </Link>
            </p>
          )}
        </section>

        <section>
          <h2 className="section-title">Explore</h2>
          <div className="grid grid--3">
            {DESTINATIONS.map((destination) => (
              <Link
                key={destination.href}
                href={destination.href}
                className="card card--link"
              >
                <div style={{ fontWeight: 600, marginBottom: 5 }}>
                  {destination.title}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
                  {destination.blurb}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <footer className="footer">
        Modular ETL pipeline · FastAPI backend · Next.js frontend
      </footer>
    </main>
  );
}
