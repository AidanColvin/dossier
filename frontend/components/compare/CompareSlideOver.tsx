"use client";

// Inline compare. Opens from the company header, takes a second company by
// name or ticker, and shows the two side by side with a generated finding on
// top. Fetches the second company itself so it never disturbs the active run.

import { useCallback, useEffect, useState } from "react";
import { fetchDemo } from "@/lib/api";
import { prettyName } from "@/lib/format";
import { generateLede } from "@/lib/summary/generateLede";
import { summarize } from "@/lib/analytics";
import { money } from "@/components/Charts";
import { ComparisonFinding } from "@/components/compare/ComparisonFinding";
import type { RunResult } from "@/lib/types";

/** Takes the base run, an open flag, and a close handler. Returns the panel. */
export function CompareSlideOver({
  base,
  open,
  onClose,
}: {
  base: RunResult;
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [other, setOther] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const load = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { response, mode } = await fetchDemo(name.trim());
      setOther({ response, mode, ranAt: Date.now(), request: { entity: name.trim() } });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  if (!open) return null;

  return (
    <div className="slideover" role="dialog" aria-modal="true" aria-label="Compare">
      <button className="slideover__scrim" aria-label="Close" onClick={onClose} />
      <div className="slideover__panel slideover__panel--wide">
        <div className="slideover__head">
          <h2>Compare</h2>
          <button type="button" className="btn btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void load(query);
          }}
        >
          <div className="search-bar">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Compare ${base.response.entity} with...`}
              aria-label="Company to compare with"
            />
            <button
              type="submit"
              className="btn btn--primary"
              disabled={busy || !query.trim()}
            >
              {busy ? "Loading" : "Compare"}
            </button>
          </div>
        </form>

        {error && (
          <p className="notice notice--error" style={{ marginTop: 14 }}>
            {error}
          </p>
        )}

        {other && (
          <div style={{ marginTop: 24 }}>
            <ComparisonFinding left={base} right={other} />
            <div className="compare-split">
              <CompareColumn run={base} />
              <CompareColumn run={other} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Takes one run. Returns a single comparison column. */
function CompareColumn({ run }: { run: RunResult }) {
  const stats = summarize(run.response);
  const profile = run.response.profile;
  const revenue = profile?.financials?.revenue;
  const latestRevenue = revenue
    ? revenue[Object.keys(revenue).sort().at(-1) as string]
    : null;

  const lede = generateLede({
    entity: prettyName(profile?.name || run.response.entity),
    records: run.response.records,
  });

  return (
    <div className="compare-col">
      <div className="compare-col__head">
        <strong>{prettyName(profile?.name || run.response.entity)}</strong>
        {profile?.ticker && (
          <span className="fact-banner__ticker">{profile.ticker}</span>
        )}
      </div>
      <div className="metrics" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="metric">
          <div className="metric__label">Records</div>
          <div className="metric__value" style={{ fontSize: 21 }}>
            {stats.total}
          </div>
        </div>
        <div className="metric">
          <div className="metric__label">Revenue</div>
          <div className="metric__value" style={{ fontSize: 21 }}>
            {latestRevenue ? money(latestRevenue) : "n/a"}
          </div>
        </div>
      </div>
      <p className="compare-col__lede">{lede}</p>
    </div>
  );
}
