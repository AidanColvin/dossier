"use client";

// The export action. Opens a small panel offering CSV, JSON, or Markdown, each
// built in the browser from the loaded run. Reuses the existing export helpers,
// so nothing leaves the page except the file the reader downloads.

import { useEffect } from "react";
import { buildExport, download, type ExportFormat } from "@/lib/exports";
import type { RunResult } from "@/lib/types";

const FORMATS: { key: ExportFormat; label: string; note: string }[] = [
  { key: "csv", label: "CSV", note: "One row per record, opens in a spreadsheet." },
  { key: "json", label: "JSON", note: "The raw response for another tool." },
  { key: "markdown", label: "Markdown", note: "A readable briefing to paste." },
];

/** Takes a run, an open flag, and a close handler. Returns the export panel. */
export function ExportPanel({
  run,
  open,
  onClose,
}: {
  run: RunResult;
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  /** Builds the chosen format and triggers its download, then closes. */
  function save(format: ExportFormat) {
    const built = buildExport(run.response, format);
    download(built.body, built.filename, built.mime);
    onClose();
  }

  return (
    <div className="slideover" role="dialog" aria-modal="true" aria-label="Export">
      <button className="slideover__scrim" aria-label="Close" onClick={onClose} />
      <div className="slideover__panel slideover__panel--narrow">
        <div className="slideover__head">
          <h2>Export</h2>
          <button type="button" className="btn btn--sm" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="slideover__lede">
          Built in your browser from the {run.response.count} records on screen.
        </p>
        <div className="export-options">
          {FORMATS.map((format) => (
            <button
              key={format.key}
              type="button"
              className="export-option"
              onClick={() => save(format.key)}
            >
              <strong>{format.label}</strong>
              <span>{format.note}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
