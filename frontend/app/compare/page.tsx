"use client";

// The compare destination. For visitors who land here directly, two search
// fields instead of the company page slide-over. Same generated finding and
// side-by-side columns. Compare is also an inline action on the company page.

import { useCallback, useState } from "react";
import { fetchDemo } from "@/lib/api";
import { prettyName, sourceLabel } from "@/lib/format";
import { generateLede } from "@/lib/summary/generateLede";
import { countBy, summarize } from "@/lib/analytics";
import { money } from "@/components/Charts";
import { ComparisonFinding } from "@/components/compare/ComparisonFinding";
import type { RunResult } from "@/lib/types";

export default function ComparePage() {
  const [left, setLeft] = useState<RunResult | null>(null);
  const [right, setRight] = useState<RunResult | null>(null);
  const [leftQuery, setLeftQuery] = useState("");
  const [rightQuery, setRightQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (name: string, set: (run: RunResult) => void) => {
      if (!name.trim()) return;
      setBusy(true);
      setError(null);
      try {
        const { response, mode } = await fetchDemo(name.trim());
        set({ response, mode, ranAt: Date.now(), request: { entity: name.trim() } });
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  return (
    <main className="page">
      <div className="canvas">
        <div className="page-head" style={{ textAlign: "center" }}>
          <h1>Compare</h1>
          <p style={{ margin: "0 auto" }}>
            Put two companies side by side, by what each actually produces.
          </p>
        </div>

        <div className="compare-inputs">
          <CompareField
            value={leftQuery}
            onChange={setLeftQuery}
            onSubmit={() => load(leftQuery, setLeft)}
            placeholder="First company or ticker"
            loaded={left}
          />
          <span className="compare-inputs__vs">vs</span>
          <CompareField
            value={rightQuery}
            onChange={setRightQuery}
            onSubmit={() => load(rightQuery, setRight)}
            placeholder="Second company or ticker"
            loaded={right}
          />
        </div>

        {error && (
          <p className="notice notice--error" style={{ marginTop: 16 }}>
            {error}
          </p>
        )}

        {left && right && (
          <div style={{ marginTop: 28 }}>
            <ComparisonFinding left={left} right={right} />
            <div className="compare-split">
              <CompareColumn run={left} />
              <CompareColumn run={right} />
            </div>
          </div>
        )}

        {(!left || !right) && !busy && (
          <p className="empty">
            Load a company on each side to see the comparison.
          </p>
        )}
      </div>
    </main>
  );
}

/** Takes field state and a submit handler. Returns one compare search field. */
function CompareField({
  value,
  onChange,
  onSubmit,
  placeholder,
  loaded,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  loaded: RunResult | null;
}) {
  return (
    <form
      className="compare-field"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="search-bar">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <button type="submit" className="btn btn--primary" disabled={!value.trim()}>
          {loaded ? "Reload" : "Load"}
        </button>
      </div>
    </form>
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
  const name = prettyName(profile?.name || run.response.entity);
  const bySource = countBy(run.response.records, (record) => record.source);
  const lede = generateLede({ entity: name, records: run.response.records });

  return (
    <div className="compare-col">
      <div className="compare-col__head">
        <strong>{name}</strong>
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
      <div className="compare-col__sources">
        {bySource.map((bucket) => (
          <div key={bucket.key} className="compare-col__source">
            <span>{sourceLabel(bucket.key)}</span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
              {bucket.count}
            </span>
          </div>
        ))}
      </div>
      <p className="compare-col__lede">{lede}</p>
    </div>
  );
}
