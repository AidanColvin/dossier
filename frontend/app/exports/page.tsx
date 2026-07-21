"use client";

// Exports — take the loaded dossier away as a file. Everything is built in
// the browser from the response already in memory, so no request leaves the
// page and the preview is exactly what downloads.

import { useMemo, useState } from "react";
import { summarize } from "@/lib/analytics";
import { buildExport, download, type ExportFormat } from "@/lib/exports";
import { useEnsureRun } from "@/lib/store";
import { Empty, PageHead, Stat } from "@/components/ui";

const FORMATS: { key: ExportFormat; label: string; blurb: string }[] = [
  {
    key: "csv",
    label: "CSV",
    blurb:
      "One row per record with provenance URLs pipe-joined. Opens cleanly in Excel, Sheets or pandas.",
  },
  {
    key: "json",
    label: "JSON",
    blurb:
      "The raw API response, unmodified — records, per-source status and counts. The format to pipe into another tool.",
  },
  {
    key: "markdown",
    label: "Markdown",
    blurb:
      "A readable briefing: source-status table, then records grouped under a heading per type. Paste into a doc or an issue.",
  },
];

export default function ExportsPage() {
  const { run } = useEnsureRun();
  const response = run?.response ?? null;
  const stats = summarize(response);
  const [format, setFormat] = useState<ExportFormat>("csv");

  const built = useMemo(
    () => (response ? buildExport(response, format) : null),
    [response, format]
  );

  // Preview only the head of the file — a 50-record CSV is not something to
  // paint into the DOM in full.
  const preview = useMemo(() => {
    if (!built) return "";
    const lines = built.body.split("\n");
    return lines.length > 40
      ? `${lines.slice(0, 40).join("\n")}\n…(${lines.length - 40} more lines)`
      : built.body;
  }, [built]);

  if (!response || !built) {
    return (
      <main className="page">
        <PageHead title="Exports">
          Download the loaded dossier as CSV, JSON or Markdown.
        </PageHead>
        <Empty>No dossier loaded yet — run a search first.</Empty>
      </main>
    );
  }

  return (
    <main className="page">
      <PageHead title="Exports">
        {`Take the ${response.entity} dossier away as a file. Built in your browser from the data already on screen.`}
      </PageHead>

      <div className="stack">

        <section>
          <div className="grid grid--3">
            <Stat label="Records" value={stats.total} />
            <Stat label="Verified" value={`${stats.verified}`} />
            <Stat
              label="File size"
              value={`${(new Blob([built.body]).size / 1024).toFixed(1)} KB`}
              hint={built.filename}
            />
          </div>
        </section>

        <section>
          <h2 className="section-title">Format</h2>
          <div className="grid grid--3">
            {FORMATS.map((option) => {
              const active = option.key === format;
              return (
                <button
                  key={option.key}
                  type="button"
                  className="card card--link"
                  onClick={() => setFormat(option.key)}
                  aria-pressed={active}
                  style={{
                    textAlign: "left",
                    cursor: "pointer",
                    font: "inherit",
                    borderColor: active ? "var(--accent)" : undefined,
                    boxShadow: active ? "var(--ring)" : undefined,
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: 5 }}>
                    {option.label}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 13.5 }}>
                    {option.blurb}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="row" style={{ marginBottom: 14 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Preview — <span className="mono">{built.filename}</span>
            </h2>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => download(built.body, built.filename, built.mime)}
            >
              Download {built.filename.split(".").pop()?.toUpperCase()}
            </button>
          </div>
          <div className="card">
            <pre
              className="mono"
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 12,
                lineHeight: 1.6,
                color: "var(--muted)",
                maxHeight: 460,
                overflowY: "auto",
              }}
            >
              {preview}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
