"use client";

// The company profile: what a search actually produces. A fact banner, the
// financial history the company reported to the SEC, its recent filings, and
// the research it is attached to.
//
// Every number here is the company's own reported figure. Nothing is modelled,
// projected or generated.

import { BarChart, LineChart, money } from "@/components/Charts";
import { formatDate, sourceLabel, typeLabel } from "@/lib/format";
import type { CompanyProfile, PipelineRecord } from "@/lib/types";

const LABELS: Record<string, string> = {
  revenue: "Revenue",
  net_income: "Net income",
  research_development: "R&D",
  assets: "Assets",
  equity: "Equity",
};

// takes: a metric series keyed by fiscal year
// does: turns it into ascending chart points
// returns: the points, or an empty array when the metric is absent
function points(series?: Record<string, number>) {
  if (!series) return [];
  return Object.entries(series)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([x, y]) => ({ x, y }));
}

// takes: a metric series
// does: computes the change from the first to the last year on record
// returns: a signed percentage string, or an empty string when not computable
function growth(series?: Record<string, number>): string {
  const p = points(series);
  if (p.length < 2 || p[0].y === 0) return "";
  const change = ((p[p.length - 1].y - p[0].y) / Math.abs(p[0].y)) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(0)}% since ${p[0].x}`;
}

export function FactBanner({ profile }: { profile: CompanyProfile }) {
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  return (
    <div className="fact-banner">
      <span className="fact-banner__name">{profile.name}</span>
      {profile.ticker && (
        <span className="fact-banner__ticker">{profile.ticker}</span>
      )}
      {profile.exchange && <span>{profile.exchange}</span>}
      {profile.industry && (
        <>
          <span style={{ color: "var(--ghost)" }}>·</span>
          <span>{profile.industry}</span>
        </>
      )}
      {location && (
        <>
          <span style={{ color: "var(--ghost)" }}>·</span>
          <span>{location}</span>
        </>
      )}
    </div>
  );
}

export function Financials({ profile }: { profile: CompanyProfile }) {
  const revenue = points(profile.financials?.revenue);
  const income = points(profile.financials?.net_income);
  const rd = points(profile.financials?.research_development);

  if (revenue.length === 0 && income.length === 0) return null;

  const latest = (series?: Record<string, number>) => {
    const p = points(series);
    return p.length ? p[p.length - 1] : null;
  };

  const revLatest = latest(profile.financials?.revenue);
  const incLatest = latest(profile.financials?.net_income);
  const rev = revLatest?.y ?? null;
  const inc = incLatest?.y ?? null;

  // Only a ratio of two figures from the same fiscal year means anything. If
  // the two series end in different years, no margin is shown at all rather
  // than a number that looks authoritative and is not.
  const margin =
    revLatest && incLatest && revLatest.x === incLatest.x && revLatest.y !== 0
      ? Math.round((incLatest.y / revLatest.y) * 100)
      : null;

  return (
    <>
      <div className="metrics">
        {rev != null && (
          <div className="metric">
            <div className="metric__label">Revenue</div>
            <div className="metric__value">{money(rev)}</div>
            <div className="metric__delta" style={{ color: "var(--muted)" }}>
              {growth(profile.financials?.revenue)}
            </div>
          </div>
        )}
        {inc != null && (
          <div className="metric">
            <div className="metric__label">Net income</div>
            <div className="metric__value">{money(inc)}</div>
            <div className="metric__delta" style={{ color: "var(--muted)" }}>
              {growth(profile.financials?.net_income)}
            </div>
          </div>
        )}
        {margin != null && (
          <div className="metric">
            <div className="metric__label">Net margin</div>
            <div className="metric__value">{margin}%</div>
            <div className="metric__delta" style={{ color: "var(--muted)" }}>
              FY {revLatest?.x}
            </div>
          </div>
        )}
        {rd.length > 0 && (
          <div className="metric">
            <div className="metric__label">R&amp;D</div>
            <div className="metric__value">{money(rd[rd.length - 1].y)}</div>
            <div className="metric__delta" style={{ color: "var(--muted)" }}>
              {growth(profile.financials?.research_development)}
            </div>
          </div>
        )}
      </div>

      {revenue.length > 1 && (
        <section style={{ marginTop: 34 }}>
          <h3 className="section-title">
            Revenue vs net income · {revenue[0].x}–{revenue[revenue.length - 1].x}
          </h3>
          <LineChart
            series={[
              { label: "Revenue", color: "var(--accent)", points: revenue },
              ...(income.length > 1
                ? [
                    {
                      label: "Net income",
                      color: "var(--src-openalex)",
                      points: income,
                    },
                  ]
                : []),
            ]}
          />
        </section>
      )}

      {rd.length > 1 && (
        <section style={{ marginTop: 34 }}>
          <h3 className="section-title">Research &amp; development spend</h3>
          <BarChart points={rd} format={money} color="var(--ink)" />
        </section>
      )}
    </>
  );
}

export function Filings({ profile }: { profile: CompanyProfile }) {
  if (!profile.filings?.length) return null;
  return (
    <section style={{ marginTop: 34 }}>
      <h3 className="section-title">Recent SEC filings</h3>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Form</th>
              <th>Filed</th>
              <th>Accession</th>
            </tr>
          </thead>
          <tbody>
            {profile.filings.slice(0, 6).map((filing) => (
              <tr key={filing.accession}>
                <td style={{ whiteSpace: "nowrap", fontWeight: 550 }}>
                  <a href={filing.url} target="_blank" rel="noopener noreferrer">
                    {filing.form}
                  </a>
                </td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatDate(filing.filed)}
                </td>
                <td className="mono" style={{ color: "var(--muted)" }}>
                  {filing.accession}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ResearchList({ records }: { records: PipelineRecord[] }) {
  if (records.length === 0) return null;
  return (
    <div>
      {records.map((record) => {
        const venue =
          typeof record.extra?.journal === "string"
            ? record.extra.journal
            : typeof record.extra?.organization === "string"
              ? record.extra.organization
              : typeLabel(record.record_type);
        return (
          <div className="result" key={`${record.source}:${record.native_id}`}>
            <span className="result__date">{formatDate(record.date)}</span>
            <div className="result__title">
              {record.url ? (
                <a href={record.url} target="_blank" rel="noopener noreferrer">
                  {record.title}
                </a>
              ) : (
                record.title
              )}
            </div>
            <div className="result__meta">
              {sourceLabel(record.source)} · {venue}
            </div>
          </div>
        );
      })}
    </div>
  );
}
