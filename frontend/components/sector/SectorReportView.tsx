"use client";

// renders one finished sector report: aggregate tiles, a per-source bar
// chart, a section per company, and the numbered reference list. everything
// here is display only; the report arrives fully assembled from the backend
// (or the bundled sample) and no number is computed twice.

import Link from "next/link";
import { money } from "@/components/Charts";
import { BarChart, Empty, SourceChip, Stat } from "@/components/ui";
import { formatDate, sourceLabel, typeLabel } from "@/lib/format";
import { sourceColor } from "@/lib/sources";
import type {
  SectorCompanySection,
  SectorRecordRow,
  SectorReport,
} from "@/lib/sectorTypes";

const METHOD_NOTES: Record<SectorReport["method"], string> = {
  curated: "companies come from the curated seed list for this sector",
  discovered:
    "companies were discovered live from 10-K filings mentioning this sector",
  default:
    "nothing matched this sector, so a default set of large companies is shown",
};

/**
 * given one displayed record row
 * render its linked title and metadata strip
 */
function ReportRecord({ record }: { record: SectorRecordRow }) {
  return (
    <div className="record">
      <div
        className="record__rail"
        style={{ background: sourceColor(record.source) }}
        aria-hidden
      />
      <div className="record__body">
        <div className="record__title">
          {record.url ? (
            <a href={record.url} target="_blank" rel="noopener noreferrer">
              {record.title}
            </a>
          ) : (
            record.title
          )}
        </div>
        <div className="record__meta">
          <span>{sourceLabel(record.source)}</span>
          <span className="record__dot">·</span>
          <span>{typeLabel(record.record_type)}</span>
          <span className="record__dot">·</span>
          <span>{formatDate(record.date)}</span>
          <span className={`badge ${record.verified ? "badge--ok" : "badge--warn"}`}>
            {record.verified ? "verified" : "unverified"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * given one company section
 * render its header row, fact line, source chips, and top records; a failed
 * company renders its error in place of records so gaps are never silent
 */
function CompanySection({ company }: { company: SectorCompanySection }) {
  const facts = company.facts;
  const factLine = [
    facts.exchange,
    facts.industry,
    facts.city && facts.state ? `${facts.city}, ${facts.state}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="card">
      <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
        <h3 style={{ margin: 0 }}>
          {company.resolved ? (
            <Link href={`/company/${encodeURIComponent(company.ticker)}`}>
              {company.name || company.ticker}
            </Link>
          ) : (
            company.name || company.ticker
          )}
        </h3>
        <span className="badge badge--neutral">{company.ticker}</span>
        <span className="count-line" style={{ marginLeft: "auto" }}>
          {company.record_count} records
        </span>
      </div>

      {factLine && <p className="count-line">{factLine}</p>}

      {(facts.revenue || facts.net_income) && (
        <div className="grid grid--2" style={{ marginTop: 8 }}>
          {facts.revenue && (
            <Stat
              label={`Revenue (FY${facts.revenue.year})`}
              value={money(facts.revenue.value)}
            />
          )}
          {facts.net_income && (
            <Stat
              label={`Net income (FY${facts.net_income.year})`}
              value={money(facts.net_income.value)}
              tone={facts.net_income.value < 0 ? "neg" : undefined}
            />
          )}
        </div>
      )}

      {!company.ok ? (
        <p className="notice notice--warn">
          This company could not be profiled: {company.error}
        </p>
      ) : (
        <>
          <div className="row" style={{ flexWrap: "wrap", gap: 6, margin: "10px 0" }}>
            {company.sources.map((status) => (
              <SourceChip
                key={status.source}
                source={status.source}
                count={status.count}
              />
            ))}
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {company.top_records.map((record) => (
              <ReportRecord key={record.url + record.title} record={record} />
            ))}
            {company.top_records.length === 0 && (
              <Empty>No records were found for this company.</Empty>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function SectorReportView({ report }: { report: SectorReport }) {
  const bySource = Object.entries(report.overview.records_by_source).map(
    ([key, count]) => ({ key, count })
  );

  return (
    <div className="stack" style={{ gap: 20 }}>
      <p className="count-line">
        {report.overview.companies_ok} of {report.overview.companies_total}{" "}
        companies profiled in {report.overview.elapsed_seconds}s ·{" "}
        {METHOD_NOTES[report.method]}
      </p>

      <div className="grid grid--4">
        <Stat label="Companies" value={report.overview.companies_total} />
        <Stat label="Records" value={report.overview.records_total} />
        <Stat
          label="Verified"
          value={`${Math.round(report.verification.ratio * 100)}%`}
          hint={`${report.verification.verified} of ${report.verification.total}`}
          tone={report.verification.ratio >= 0.5 ? "pos" : "warn"}
        />
        <Stat label="Sources cited" value={report.references.length} />
      </div>

      <div>
        <h2 className="section-title">Records by source</h2>
        <BarChart
          buckets={bySource}
          color={sourceColor}
          label={sourceLabel}
          emptyText="No records."
        />
      </div>

      <div>
        <h2 className="section-title">Companies</h2>
        <div className="stack" style={{ gap: 14 }}>
          {report.companies.map((company) => (
            <CompanySection key={company.ticker} company={company} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="section-title">References</h2>
        <ol className="stack" style={{ gap: 4 }}>
          {report.references.map((reference) => (
            <li key={reference.n} className="count-line">
              <a href={reference.url} target="_blank" rel="noopener noreferrer">
                {reference.url}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
