"use client";

// The canonical company page at /company/[ticker]. The URL is shareable and
// stable: landing here runs the pipeline for that ticker and renders the full
// company view. The ticker segment doubles as the entity query, since the
// backend resolves either a ticker or a name to the same company.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { CompanyView } from "@/components/company/CompanyView";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { prettyName } from "@/lib/format";
import { readRecentlyViewed, recordVisit } from "@/lib/storage/recentlyViewed";
import { useRun } from "@/lib/store";

export default function CompanyPage() {
  const params = useParams();
  const ticker = decodeURIComponent(
    Array.isArray(params.ticker) ? params.ticker[0] : params.ticker ?? ""
  );
  const { run, loading, error, execute, hydrated } = useRun();

  // Run the pipeline for the URL's company once hydrated, and again whenever
  // the ticker changes. The guard avoids re-running for a company already
  // loaded (for example when arriving from a same-company link).
  const requestedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!hydrated || !ticker) return;
    const already =
      run?.request.entity?.toUpperCase() === ticker.toUpperCase() ||
      run?.response.ticker?.toUpperCase() === ticker.toUpperCase();
    if (already || requestedFor.current === ticker) return;
    requestedFor.current = ticker;
    void execute({ entity: ticker, ticker, max_results: 25 });
  }, [hydrated, ticker, run, execute]);

  const showingThisCompany =
    run &&
    (run.request.entity?.toUpperCase() === ticker.toUpperCase() ||
      run.response.ticker?.toUpperCase() === ticker.toUpperCase());

  // Record the visit once this company's run has landed, so the homepage can
  // show it under "recently viewed" on the next visit. Before overwriting the
  // stored count, compare against it: a returning reader gets told exactly
  // how many records are new since they last looked.
  const [newSinceLastVisit, setNewSinceLastVisit] = useState(0);
  useEffect(() => {
    if (!showingThisCompany || !run) return;
    const profile = run.response.profile;
    const displayTicker = profile?.ticker || ticker;
    const previous = readRecentlyViewed().find(
      (item) => item.ticker.toUpperCase() === displayTicker.toUpperCase()
    );
    if (previous && run.response.count > previous.lastRecordCount) {
      setNewSinceLastVisit(run.response.count - previous.lastRecordCount);
    }
    recordVisit(
      displayTicker,
      prettyName(profile?.name || run.response.entity),
      run.response.count
    );
  }, [showingThisCompany, run, ticker]);

  return (
    <main className="page page--wide">
      <div className="canvas">
        {error && <p className="notice notice--error">{error}</p>}

        {loading && !showingThisCompany && (
          <p className="count-line" aria-live="polite">
            Loading records for {ticker}
          </p>
        )}

        {showingThisCompany && newSinceLastVisit > 0 && (
          <p className="notice notice--info" style={{ marginBottom: 8 }}>
            {newSinceLastVisit} new record{newSinceLastVisit === 1 ? "" : "s"}{" "}
            since your last visit.
          </p>
        )}

        {showingThisCompany && run && (
          <div className="row" style={{ justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
            <Link href={`/report/${encodeURIComponent(ticker)}`} className="chip">
              Full report
            </Link>
            <SaveToProject
              bundle={{
                name: prettyName(run.response.profile?.name || run.response.entity),
                mode: "company",
                subject: run.response.ticker || run.response.entity,
                company: run,
              }}
            />
          </div>
        )}

        {showingThisCompany && <CompanyView run={run} />}
      </div>
    </main>
  );
}
