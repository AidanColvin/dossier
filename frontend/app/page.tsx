"use client";

// Home — search, and the company profile it produces.
//
// Before a search it explains what the app does and shows a sample of the
// output, so a first-time visitor understands the product without running
// anything. After a search the whole page becomes the profile.

import { useCallback, useMemo, useState } from "react";
import { BarChart, LineChart, money } from "@/components/Charts";
import {
  FactBanner,
  Filings,
  Financials,
  ResearchList,
} from "@/components/Profile";
import { useRun } from "@/lib/store";

const SUGGESTIONS = ["Apple", "NVIDIA", "Pfizer", "Moderna", "Tesla"];

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "filing", label: "Filings" },
  { key: "paper", label: "Research" },
  { key: "trial", label: "Trials" },
  { key: "grant", label: "Grants" },
];

export default function HomePage() {
  // The home page deliberately does not auto-load a dossier: a first-time
  // visitor should meet the product and a sample of its output, not a data
  // dump for a company they did not ask about. The deeper routes still use
  // useEnsureRun, so landing on /records directly is never empty.
  const { run, loading, error, execute } = useRun();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");

  const records = useMemo(() => run?.response.records ?? [], [run]);
  const profile = run?.response.profile ?? null;

  const search = useCallback(
    (entity: string) => {
      if (!entity.trim()) return;
      setTab("all");
      void execute({ entity: entity.trim(), max_results: 10 });
    },
    [execute]
  );

  const counts = useMemo(() => {
    const totals: Record<string, number> = { all: records.length };
    for (const record of records) {
      totals[record.record_type] = (totals[record.record_type] ?? 0) + 1;
    }
    return totals;
  }, [records]);

  const visible = useMemo(
    () =>
      [...(tab === "all"
        ? records
        : records.filter((r) => r.record_type === tab))].sort((a, b) =>
        b.date.localeCompare(a.date)
      ),
    [records, tab]
  );

  return (
    <main className="page page--wide">
      <div className="canvas">
        <div className="hero">
          <h1>Every public record, in one place.</h1>
          <p>
            Search a company. Get its filings, financials, research, trials and
            grants — assembled from primary sources.
          </p>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              search(query);
            }}
          >
            <div className="search-bar">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search any public company or ticker"
                aria-label="Search any public company or ticker"
                autoComplete="organization"
              />
              <button
                type="submit"
                className="btn btn--primary"
                disabled={loading || !query.trim()}
              >
                {loading ? "Working…" : "Search"}
              </button>
            </div>
          </form>

          <div className="suggestions">
            {SUGGESTIONS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setQuery(name);
                  search(name);
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="notice notice--error" style={{ marginTop: 34 }}>
            {error}
          </p>
        )}

        {loading && (
          <p className="count-line" aria-live="polite">
            Reading SEC filings, research, trials and grants…
          </p>
        )}

        {!loading && run && (
          <div style={{ marginTop: 56 }}>
            {profile?.ok ? (
              <FactBanner profile={profile} />
            ) : (
              <div className="fact-banner">
                <span className="fact-banner__name">{run.response.entity}</span>
                <span>
                  No SEC registrant matched — showing research records only.
                </span>
              </div>
            )}

            {profile?.ok && <Financials profile={profile} />}
            {profile?.ok && <Filings profile={profile} />}

            {records.length > 0 && (
              <section style={{ marginTop: 40 }}>
                <div className="row" style={{ marginBottom: 16 }}>
                  <h3 className="section-title" style={{ margin: 0 }}>
                    Research, trials and grants
                  </h3>
                  <span className="spacer" />
                  <div className="tabs" style={{ margin: 0 }}>
                    {TABS.filter((t) => counts[t.key]).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        data-active={tab === t.key}
                        onClick={() => setTab(t.key)}
                      >
                        {t.label} {counts[t.key]}
                      </button>
                    ))}
                  </div>
                </div>
                <ResearchList records={visible} />
              </section>
            )}
          </div>
        )}

        {!run && !loading && <Explainer />}
      </div>
    </main>
  );
}

// takes: nothing
// does: renders the pre-search explanation — what the app produces, a sample
//       of the real output shape, and what each source contributes
// returns: the explainer section
function Explainer() {
  // Illustrative figures for the sample card only. Labelled as a sample, and
  // never mixed with a real run: this block disappears the moment one lands.
  const sample = [
    { x: "2021", y: 260_174_000_000 },
    { x: "2022", y: 274_515_000_000 },
    { x: "2023", y: 365_817_000_000 },
    { x: "2024", y: 394_328_000_000 },
    { x: "2025", y: 383_285_000_000 },
  ];

  return (
    <>
      <div className="section-band">
        <div className="split">
          <div>
            <div className="canvas__eyebrow">The problem</div>
            <h2>Company research is scattered across four agencies.</h2>
            <p>
              Filings live at the SEC. Papers live in OpenAlex. Trials live at
              ClinicalTrials.gov. Grants live at NIH RePORTER. Answering one
              question about one company means four searches, four formats, and
              no way to line them up.
            </p>
            <p style={{ marginBottom: 0 }}>
              Dossier resolves the company once, then queries all four as that
              company — and returns one normalized, deduplicated, sourced record
              set with the financials attached.
            </p>
          </div>

          <div className="sample">
            <div className="sample__label">Sample output</div>
            <div className="sample__card">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 9,
                  marginBottom: 16,
                }}
              >
                <strong style={{ fontSize: 19, letterSpacing: "-0.02em" }}>
                  Apple
                </strong>
                <span className="fact-banner__ticker">AAPL</span>
                <span style={{ fontSize: 12.5, color: "var(--faint)" }}>
                  Nasdaq
                </span>
              </div>

              <div
                className="metrics"
                style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 18 }}
              >
                <div className="metric">
                  <div className="metric__label">Revenue</div>
                  <div className="metric__value" style={{ fontSize: 21 }}>
                    {money(383_285_000_000)}
                  </div>
                </div>
                <div className="metric">
                  <div className="metric__label">R&amp;D</div>
                  <div className="metric__value" style={{ fontSize: 21 }}>
                    {money(29_900_000_000)}
                  </div>
                </div>
              </div>

              <div className="sample__label" style={{ marginBottom: 8 }}>
                Revenue · 5 years
              </div>
              <LineChart
                series={[
                  { label: "Revenue", color: "var(--accent)", points: sample },
                ]}
                height={110}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="section-band">
        <div className="canvas__eyebrow" style={{ marginBottom: 26 }}>
          What every search returns
        </div>
        <div className="features">
          <Feature
            title="Filings"
            body="Every recent SEC filing with its form type, date and a direct link into EDGAR's archive."
          />
          <Feature
            title="Financials"
            body="Five years of revenue, net income and R&D, read from the company's own XBRL filings."
          />
          <Feature
            title="Research"
            body="Papers authored at the company, matched by institution rather than keyword."
          />
          <Feature
            title="Trials and grants"
            body="Clinical studies it sponsors and the federally funded work that names it."
          />
        </div>
      </div>
    </>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="feature">
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
