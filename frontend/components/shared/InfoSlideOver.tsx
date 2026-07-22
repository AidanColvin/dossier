"use client";

// A slide-over panel that holds the "how it works" explanation and the source
// list. Opened from the footer link and the header info icon, so this content
// no longer needs its own routes.

import { useEffect } from "react";

const SOURCES = [
  { label: "SEC EDGAR", yields: "filings and financials", host: "sec.gov" },
  { label: "OpenAlex", yields: "research papers", host: "openalex.org" },
  { label: "ClinicalTrials.gov", yields: "clinical trials", host: "clinicaltrials.gov" },
  { label: "NIH RePORTER", yields: "research grants", host: "reporter.nih.gov" },
];

const STAGES = [
  "Resolve the company to a single identity against SEC EDGAR.",
  "Query all four sources in parallel as that company.",
  "Normalize every result into one record shape.",
  "Deduplicate across sources, merging provenance URLs.",
  "Verify: a record is trusted when two or more sources attest to it.",
];

/** Takes an open flag and a close handler. Returns the info panel. */
export function InfoSlideOver({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Close on Escape so the panel is dismissible from the keyboard.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="slideover" role="dialog" aria-modal="true" aria-label="How it works">
      <button className="slideover__scrim" aria-label="Close" onClick={onClose} />
      <div className="slideover__panel">
        <div className="slideover__head">
          <h2>How it works</h2>
          <button type="button" className="btn btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        <p className="slideover__lede">
          Dossier compiles a company profile from four free, keyless, primary
          sources. No language model runs in the request path, so every number
          and citation traces to a public record.
        </p>

        <h3 className="section-title">The pipeline</h3>
        <ol className="slideover__stages">
          {STAGES.map((stage) => (
            <li key={stage}>{stage}</li>
          ))}
        </ol>

        <h3 className="section-title">Sources</h3>
        <div className="slideover__sources">
          {SOURCES.map((source) => (
            <div key={source.label} className="slideover__source">
              <strong>{source.label}</strong>
              <span>{source.yields}</span>
              <a
                href={`https://${source.host}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {source.host}
              </a>
            </div>
          ))}
        </div>

        <p className="slideover__foot">
          <a
            href="https://github.com/AidanColvin/dossier"
            target="_blank"
            rel="noopener noreferrer"
          >
            View the source on GitHub
          </a>
        </p>
      </div>
    </div>
  );
}
