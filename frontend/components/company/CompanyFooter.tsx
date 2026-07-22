"use client";

// The muted footer strip. States the totals and provenance count, credits the
// four sources, and opens the "how it works" panel rather than routing away.

import { useMemo } from "react";
import { summarize } from "@/lib/analytics";
import type { RunResult } from "@/lib/types";

/** Takes a run result and a handler. Returns the footer summary line. */
export function CompanyFooter({
  run,
  onHowItWorks,
}: {
  run: RunResult;
  onHowItWorks: () => void;
}) {
  const stats = useMemo(() => summarize(run.response), [run]);

  const parts = [
    `${stats.total} ${stats.total === 1 ? "record" : "records"}`,
    `${stats.sourcesOk} ${stats.sourcesOk === 1 ? "source" : "sources"}`,
    `${stats.provenanceLinks} provenance URLs`,
  ];

  return (
    <footer className="company-foot">
      <span>
        {parts.join(" · ")}. Data from SEC EDGAR, ClinicalTrials.gov, NIH
        RePORTER, OpenAlex.{" "}
        <button type="button" className="linklike" onClick={onHowItWorks}>
          How it works
        </button>
      </span>
    </footer>
  );
}
