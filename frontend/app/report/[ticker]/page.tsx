"use client";

// the full report at /report/[ticker]: the deep-dive document view of a
// company, and where the home page search lands. where /company/[ticker] is
// the interactive dossier, this page is the readable artifact: executive
// summary first, then the company overview in its own 10-K words, strategic
// direction signals, revenue trajectory with growth rates and charts,
// profitability, research and partnership records, workforce and competitive
// signals, risks, outlook, filings, leadership, and numbered sources. it
// exports as markdown, word, and pdf (print), all rendered from one model.

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { BarChart, LineChart, OrgChart, type Series } from "@/components/Charts";
import { Empty, SourceChip } from "@/components/ui";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { download } from "@/lib/exports";
import { formatDate } from "@/lib/format";
import {
  buildReportModel,
  companyReportMarkdown,
  companyReportWordHtml,
  reportMoney,
  signedPct,
} from "@/lib/report/companyReport";
import { safeUrl } from "@/lib/safeUrl";
import type { PipelineRecord } from "@/lib/types";
import { useRun } from "@/lib/store";

/** Takes a section title and children. Renders one report section. */
function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 36 }}>
      <h2 className="section-title" style={{ fontSize: 22 }}>{title}</h2>
      <div style={{ marginTop: 10 }}>{children}</div>
      {note && <p className="count-line" style={{ marginTop: 6 }}>{note}</p>}
    </section>
  );
}

/** Takes records. Renders them as linked report lines. */
function SignalList({ records }: { records: PipelineRecord[] }) {
  return (
    <ul className="stack" style={{ gap: 6, paddingLeft: 18, margin: 0 }}>
      {records.map((record) => (
        <li key={record.native_id}>
          {safeUrl(record.url) ? (
            <a href={safeUrl(record.url)} target="_blank" rel="noopener noreferrer">
              {record.title}
            </a>
          ) : (
            record.title
          )}
          {record.date && (
            <span className="count-line" style={{ display: "inline" }}>
              {" "}({formatDate(record.date)})
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function ReportPage() {
  const params = useParams();
  const ticker = decodeURIComponent(
    Array.isArray(params.ticker) ? params.ticker[0] : params.ticker ?? ""
  );
  const { run, loading, error, execute, hydrated } = useRun();

  // load the company exactly the way the company page does, so arriving
  // here directly (a shared link) still produces the full report.
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

  const showing =
    run &&
    (run.request.entity?.toUpperCase() === ticker.toUpperCase() ||
      run.response.ticker?.toUpperCase() === ticker.toUpperCase());

  const model = useMemo(
    () => (showing && run ? buildReportModel(run) : null),
    [showing, run]
  );

  const financialSeries: Series[] = useMemo(() => {
    if (!model) return [];
    const wanted: Array<[string, string, string]> = [
      ["revenue", "Revenue", "var(--accent)"],
      ["net_income", "Net income", "var(--pos)"],
      ["research_development", "R&D", "var(--warn)"],
    ];
    return wanted
      .map(([metric, label, color]) => {
        const row = model.financialRows.find((r) => r.metric === metric);
        return row
          ? { label, color, points: row.values.map((v) => ({ x: v.year, y: v.value })) }
          : null;
      })
      .filter((series): series is Series => series !== null && series.points.length >= 2);
  }, [model]);

  return (
    <main className="page">
      <div className="canvas">
        {error && <p className="notice notice--error">{error}</p>}
        {loading && !showing && (
          <p className="count-line" aria-live="polite">
            Building the report for {ticker}
          </p>
        )}

        {model && (
          <article className="report-doc">
            <header>
              <h1 style={{ fontSize: 34, marginBottom: 4 }}>
                {model.name}: Company Deep Dive
              </h1>
              {model.factLine && (
                <p className="count-line" style={{ fontFamily: "var(--mono)" }}>
                  {model.factLine}
                </p>
              )}
              <div className="row no-print" style={{ gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                <button
                  type="button"
                  className="chip"
                  onClick={() =>
                    download(companyReportMarkdown(model),
                             `${model.ticker || model.name}-report.md`,
                             "text/markdown")
                  }
                >
                  Download Markdown
                </button>
                <button
                  type="button"
                  className="chip"
                  onClick={() =>
                    download(companyReportWordHtml(model),
                             `${model.ticker || model.name}-report.doc`,
                             "application/msword")
                  }
                >
                  Download Word
                </button>
                <button type="button" className="chip" onClick={() => window.print()}>
                  Download PDF
                </button>
                {run && (
                  <SaveToProject
                    bundle={{
                      name: `${model.name} report`,
                      mode: "company",
                      subject: model.ticker || model.name,
                      company: run,
                    }}
                  />
                )}
                <Link href={`/company/${encodeURIComponent(ticker)}`} className="chip">
                  Interactive view
                </Link>
              </div>
            </header>

            <Section title="Executive Summary">
              <p style={{ fontSize: 17, lineHeight: 1.65, margin: 0 }}>
                {model.executiveSummary.join(" ")}
              </p>
            </Section>

            {model.business && (
              <Section
                title="Company Overview"
                note="The company's own words, from its latest annual report."
              >
                <p style={{ margin: 0 }}>{model.business}</p>
              </Section>
            )}

            {model.strategic.length > 0 && (
              <Section
                title="Strategic Direction"
                note="Signals derived from the company's own spending, research output, and filings."
              >
                <div className="stack" style={{ gap: 10 }}>
                  {model.strategic.map((signal) => (
                    <p key={signal.heading} style={{ margin: 0 }}>
                      <strong>{signal.heading}.</strong> {signal.text}
                    </p>
                  ))}
                </div>
              </Section>
            )}

            {(model.revenueTrajectory.length > 0 || model.financialRows.length > 0) && (
              <Section
                title="Business Model & Financial Performance"
                note="Every figure from the company's XBRL filings with the SEC."
              >
                {model.revenueTrajectory.length > 0 && (
                  <>
                    <h3 className="section-title" style={{ fontSize: 15, marginBottom: 8 }}>
                      Revenue Trajectory
                    </h3>
                    <div className="table-wrap">
                      <table className="data">
                        <thead>
                          <tr>
                            <th>Fiscal Year</th>
                            <th style={{ textAlign: "right" }}>Revenue</th>
                            <th style={{ textAlign: "right" }}>YoY Growth</th>
                          </tr>
                        </thead>
                        <tbody>
                          {model.revenueTrajectory.map((row) => (
                            <tr key={row.year}>
                              <td>FY{row.year}</td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                {reportMoney(row.revenue)}
                              </td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                {row.yoyPct == null ? "—" : signedPct(row.yoyPct)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {model.revenueTrajectory.length >= 2 && (
                      <div style={{ marginTop: 16 }}>
                        <p className="count-line" style={{ marginBottom: 6 }}>
                          Revenue by fiscal year
                        </p>
                        <BarChart
                          points={model.revenueTrajectory.map((row) => ({
                            x: `FY${row.year.slice(2)}`,
                            y: row.revenue,
                          }))}
                          color="var(--accent)"
                          format={reportMoney}
                        />
                      </div>
                    )}
                  </>
                )}

                {model.profitability.length > 0 && (
                  <>
                    <h3 className="section-title" style={{ fontSize: 15, margin: "18px 0 8px" }}>
                      FY{model.profitabilityYear} Profitability
                    </h3>
                    <div className="table-wrap">
                      <table className="data">
                        <thead>
                          <tr>
                            <th>Metric</th>
                            <th style={{ textAlign: "right" }}>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {model.profitability.map((line) => (
                            <tr key={line.label}>
                              <td>{line.label}</td>
                              <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                {line.value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {model.financialRows.length > 0 && (
                  <>
                    <h3 className="section-title" style={{ fontSize: 15, margin: "18px 0 8px" }}>
                      Financial History
                    </h3>
                    <div className="table-wrap">
                      <table className="data">
                        <thead>
                          <tr>
                            <th>Metric</th>
                            {model.financialYears.map((year) => (
                              <th key={year} style={{ textAlign: "right" }}>FY{year}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {model.financialRows.map((row) => (
                            <tr key={row.metric}>
                              <td>{row.label}</td>
                              {model.financialYears.map((year) => {
                                const entry = row.values.find((v) => v.year === year);
                                return (
                                  <td key={year} style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                    {entry ? reportMoney(entry.value) : ""}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {financialSeries.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <LineChart series={financialSeries} />
                  </div>
                )}
                {model.rdSentence && <p style={{ marginTop: 10 }}>{model.rdSentence}</p>}
              </Section>
            )}

            {(model.papers.length > 0 || model.trials.length > 0 || model.grants.length > 0) && (
              <Section
                title="Research, Partnerships & Pipeline"
                note="Co-authored papers, registered trials, and federal awards tied to the company."
              >
                <div className="stack" style={{ gap: 14 }}>
                  {model.papers.length > 0 && (
                    <div>
                      <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                        <SourceChip source="openalex" count={model.papers.length} />
                      </div>
                      <SignalList records={model.papers} />
                    </div>
                  )}
                  {model.trials.length > 0 && (
                    <div>
                      <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                        <SourceChip source="clinicaltrials" count={model.trials.length} />
                      </div>
                      <SignalList records={model.trials} />
                    </div>
                  )}
                  {model.grants.length > 0 && (
                    <div>
                      <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                        <SourceChip source="nih_reporter" count={model.grants.length} />
                      </div>
                      <SignalList records={model.grants} />
                    </div>
                  )}
                </div>
              </Section>
            )}

            {model.workforce && (
              <Section
                title="Hiring & Workforce Signals"
                note="From the company's own filings."
              >
                <p style={{ margin: 0 }}>{model.workforce}</p>
              </Section>
            )}

            {model.competitive.length > 0 && (
              <Section
                title="Competitive Positioning"
                note="In the company's own words, from its latest filings."
              >
                <ul className="stack" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
                  {model.competitive.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Section>
            )}

            {model.riskHeadlines.length > 0 && (
              <Section
                title="Key Risks, As the Company Names Them"
                note="Risk categories from Item 1A of the latest 10-K."
              >
                <ul className="stack" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
                  {model.riskHeadlines.map((headline) => (
                    <li key={headline}>{headline}</li>
                  ))}
                </ul>
              </Section>
            )}

            {model.outlook && (
              <Section
                title="Outlook"
                note="From management's discussion in the latest annual report."
              >
                <p style={{ margin: 0 }}>{model.outlook}</p>
              </Section>
            )}

            {model.filings.length > 0 && (
              <Section title="Recent SEC Filings">
                <ul className="stack" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
                  {model.filings.map((filing) => (
                    <li key={filing.url + filing.filed}>
                      {safeUrl(filing.url) ? (
                        <a href={safeUrl(filing.url)} target="_blank" rel="noopener noreferrer">
                          {filing.form}
                        </a>
                      ) : (
                        filing.form
                      )}
                      , filed {formatDate(filing.filed)}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {model.leadership.length > 0 && (
              <Section
                title="Leadership"
                note="Named officers from recent SEC Form 4 filings."
              >
                <OrgChart leaders={model.leadership} />
              </Section>
            )}

            <Section title="Sources">
              {model.sources.length === 0 ? (
                <Empty>No sources on file.</Empty>
              ) : (
                <ol className="stack" style={{ gap: 3, paddingLeft: 18, margin: 0 }}>
                  {model.sources.map((url) => (
                    <li key={url} className="count-line">
                      {safeUrl(url) ? (
                        <a href={safeUrl(url)} target="_blank" rel="noopener noreferrer">
                          {url}
                        </a>
                      ) : (
                        url
                      )}
                    </li>
                  ))}
                </ol>
              )}
              <p className="count-line" style={{ marginTop: 10 }}>
                {model.generatedFrom}
              </p>
            </Section>
          </article>
        )}
      </div>
    </main>
  );
}
