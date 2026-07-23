// the full company report: one model, three renderings.
//
// buildReportModel derives every section of a board-ready deep dive from a
// finished run: executive summary, company overview in the 10-K's own words,
// strategic direction signals, revenue trajectory with growth rates,
// profitability, research and partnership records, workforce and competitive
// signals, risks, filings, outlook, leadership, and a numbered source list.
// the page, the markdown download, and the word download all render from
// this one model, so the three can never disagree. deterministic throughout:
// no model, no randomness. every sentence is derived from the filings and
// records already in hand.

import { financeSentence, identitySentence } from "@/lib/summary/generateLede";
import { prettyName } from "@/lib/format";
import type { CompanyProfile, PipelineRecord, RunResult } from "@/lib/types";

export interface ReportFinancialRow {
  metric: string;
  label: string;
  values: Array<{ year: string; value: number }>;
}

export interface TrajectoryRow {
  year: string;
  revenue: number;
  /** year-over-year growth in percent, null for the first year on file. */
  yoyPct: number | null;
}

export interface StrategicSignal {
  heading: string;
  text: string;
}

export interface ReportModel {
  name: string;
  ticker: string;
  factLine: string;
  executiveSummary: string[];
  business: string;
  strategic: StrategicSignal[];
  revenueTrajectory: TrajectoryRow[];
  profitability: Array<{ label: string; value: string }>;
  profitabilityYear: string;
  financialYears: string[];
  financialRows: ReportFinancialRow[];
  rdSentence: string;
  workforce: string;
  competitive: string[];
  riskHeadlines: string[];
  filings: Array<{ form: string; filed: string; url: string }>;
  papers: PipelineRecord[];
  trials: PipelineRecord[];
  grants: PipelineRecord[];
  outlook: string;
  leadership: Array<{ name: string; title: string }>;
  sources: string[];
  generatedFrom: string;
}

const METRIC_LABELS: Array<[string, string]> = [
  ["revenue", "Revenue"],
  ["net_income", "Net income"],
  ["research_development", "R&D"],
  ["assets", "Total assets"],
  ["equity", "Stockholders' equity"],
];

/** Takes a dollar amount. Returns it compact: $416.2B, $89.3M. */
export function reportMoney(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${abs.toLocaleString()}`;
}

/** Takes a growth rate in percent. Returns it signed to one decimal: +15.1%. */
export function signedPct(value: number): string {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}%`;
}

/** Takes prose. Returns its sentences, split on terminal punctuation. */
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Takes the financials map. Returns the R&D trajectory sentence, or "" when
 * fewer than two years of R&D are on file.
 */
function rdGrowthSentence(
  financials: Record<string, Record<string, number>>
): string {
  const rd = financials.research_development ?? {};
  const years = Object.keys(rd).sort();
  if (years.length < 2) return "";
  const first = rd[years[0]];
  const last = rd[years[years.length - 1]];
  if (!first || !last) return "";
  const growth = Math.round(((last - first) / Math.abs(first)) * 100);
  const direction = growth >= 0 ? "grew" : "fell";
  return (
    `R&D spend ${direction} ${Math.abs(growth)}%, from ${reportMoney(first)} ` +
    `in ${years[0]} to ${reportMoney(last)} in ${years[years.length - 1]}.`
  );
}

/**
 * Takes the financials map. Returns the R&D intensity sentence for the latest
 * year that has both revenue and R&D, or "" when either is missing.
 */
function rdIntensitySentence(
  financials: Record<string, Record<string, number>>
): string {
  const revenue = financials.revenue ?? {};
  const rd = financials.research_development ?? {};
  const years = Object.keys(revenue)
    .filter((year) => rd[year] != null && revenue[year])
    .sort();
  const latest = years[years.length - 1];
  if (!latest) return "";
  const share = Math.round((rd[latest] / revenue[latest]) * 1000) / 10;
  return `In FY${latest}, R&D was ${share}% of revenue.`;
}

/**
 * Takes the run's records. Returns the evidence sentence for the executive
 * summary: what the record set covers and how much of it is verified.
 */
function evidenceSentence(records: PipelineRecord[]): string {
  if (records.length === 0) return "";
  const byType = new Map<string, number>();
  for (const record of records) {
    byType.set(record.record_type, (byType.get(record.record_type) ?? 0) + 1);
  }
  const labels: Record<string, string> = {
    filing: "SEC filings",
    paper: "research papers",
    trial: "clinical trials",
    grant: "federal grants",
  };
  const parts = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${count} ${labels[type] ?? type}`);
  const verified = records.filter((r) => r.verified).length;
  return (
    `This report draws on ${parts.join(", ")}, ` +
    `${verified} of ${records.length} verified against primary sources.`
  );
}

/**
 * Takes the revenue series. Returns the trajectory table rows with
 * year-over-year growth, oldest year first.
 */
function revenueTrajectoryRows(
  financials: Record<string, Record<string, number>>
): TrajectoryRow[] {
  const revenue = financials.revenue ?? {};
  const years = Object.keys(revenue)
    .filter((year) => revenue[year] != null)
    .sort();
  return years.map((year, index) => {
    const prior = index > 0 ? revenue[years[index - 1]] : null;
    const yoyPct =
      prior != null && prior !== 0
        ? ((revenue[year] - prior) / Math.abs(prior)) * 100
        : null;
    return { year, revenue: revenue[year], yoyPct };
  });
}

/**
 * Takes the financials map. Returns the latest fiscal year's profitability
 * lines and the year they describe: net income, net margin, R&D, and R&D
 * intensity, each only when on file.
 */
function profitabilityLines(
  financials: Record<string, Record<string, number>>
): { year: string; lines: Array<{ label: string; value: string }> } {
  const revenue = financials.revenue ?? {};
  const years = Object.keys(revenue).sort();
  const latest = years[years.length - 1];
  if (!latest) return { year: "", lines: [] };

  const lines: Array<{ label: string; value: string }> = [
    { label: "Revenue", value: reportMoney(revenue[latest]) },
  ];
  const netIncome = financials.net_income?.[latest];
  if (netIncome != null) {
    lines.push({
      label: netIncome >= 0 ? "Net income" : "Net loss",
      value: reportMoney(netIncome),
    });
    if (revenue[latest]) {
      const margin = Math.round((netIncome / revenue[latest]) * 1000) / 10;
      lines.push({ label: "Net margin", value: `${margin}%` });
    }
  }
  const rd = financials.research_development?.[latest];
  if (rd != null) {
    lines.push({ label: "R&D spend", value: reportMoney(rd) });
    if (revenue[latest]) {
      const share = Math.round((rd / revenue[latest]) * 1000) / 10;
      lines.push({ label: "R&D as % of revenue", value: `${share}%` });
    }
  }
  const assets = financials.assets?.[latest];
  if (assets != null) lines.push({ label: "Total assets", value: reportMoney(assets) });
  const equity = financials.equity?.[latest];
  if (equity != null) {
    lines.push({ label: "Stockholders' equity", value: reportMoney(equity) });
  }
  return { year: latest, lines: lines.length > 1 ? lines : [] };
}

/** Takes a record's date. Returns its four digit year, or "" when undated. */
function yearOf(record: PipelineRecord): string {
  const year = record.date?.slice(0, 4) ?? "";
  return /^\d{4}$/.test(year) ? year : "";
}

/**
 * Takes the profile, records, and financials. Returns the strategic direction
 * signals: where the company is putting money and effort, read from its own
 * spending, research output, trial registrations, and grant awards.
 */
function strategicSignals(
  profile: CompanyProfile | null | undefined,
  records: PipelineRecord[],
  financials: Record<string, Record<string, number>>
): StrategicSignal[] {
  const signals: StrategicSignal[] = [];
  const byDateDesc = (a: PipelineRecord, b: PipelineRecord) =>
    b.date.localeCompare(a.date);

  const rdText = [rdGrowthSentence(financials), rdIntensitySentence(financials)]
    .filter(Boolean)
    .join(" ");
  if (rdText) signals.push({ heading: "Investment in R&D", text: rdText });

  const papers = records.filter((r) => r.record_type === "paper").sort(byDateDesc);
  if (papers.length > 0) {
    const oldest = yearOf(papers[papers.length - 1]);
    const newest = papers[0];
    const span = oldest ? ` since ${oldest}` : "";
    signals.push({
      heading: "Research output",
      text:
        `${papers.length} affiliated research paper${papers.length === 1 ? "" : "s"}` +
        `${span}, most recently "${newest.title}"` +
        `${yearOf(newest) ? ` (${yearOf(newest)})` : ""}. ` +
        `Publication topics show where the company's researchers are working now.`,
    });
  }

  const trials = records.filter((r) => r.record_type === "trial").sort(byDateDesc);
  if (trials.length > 0) {
    const newest = trials[0];
    signals.push({
      heading: "Clinical pipeline",
      text:
        `${trials.length} registered clinical trial${trials.length === 1 ? "" : "s"}` +
        ` on file, most recently "${newest.title}"` +
        `${yearOf(newest) ? ` (${yearOf(newest)})` : ""}.`,
    });
  }

  const grants = records.filter((r) => r.record_type === "grant").sort(byDateDesc);
  if (grants.length > 0) {
    const newest = grants[0];
    signals.push({
      heading: "Federal research funding",
      text:
        `${grants.length} federal grant${grants.length === 1 ? "" : "s"} on file, ` +
        `most recently "${newest.title}"` +
        `${yearOf(newest) ? ` (${yearOf(newest)})` : ""}. ` +
        `Grant awards mark research directions with outside validation.`,
    });
  }

  const assetYears = Object.keys(financials.assets ?? {}).sort();
  const latestAssetYear = assetYears[assetYears.length - 1];
  if (latestAssetYear) {
    const assets = financials.assets?.[latestAssetYear];
    const equity = financials.equity?.[latestAssetYear];
    if (assets != null && equity != null) {
      signals.push({
        heading: "Balance sheet capacity",
        text:
          `The company carried ${reportMoney(assets)} in total assets against ` +
          `${reportMoney(equity)} of stockholders' equity in FY${latestAssetYear}, ` +
          `the base that funds whatever it does next.`,
      });
    }
  }

  return signals;
}

/**
 * Takes the profile. Returns the workforce sentences the company itself put
 * in its filings: any sentence naming an employee count, or "" when the
 * excerpts on file never mention one.
 */
function workforceSentence(profile: CompanyProfile | null | undefined): string {
  const texts = [profile?.business_summary, profile?.outlook].filter(
    (text): text is string => Boolean(text)
  );
  for (const text of texts) {
    for (const sentence of sentencesOf(text)) {
      if (/\b\d[\d,]*\s+(?:full[- ]time\s+|part[- ]time\s+)?(?:employees|people)\b/i.test(sentence)) {
        return sentence;
      }
    }
  }
  return "";
}

/**
 * Takes the profile. Returns competitive positioning lines in the company's
 * own words: sentences from its filings that name competition, plus any
 * competition-flavored risk categories.
 */
function competitiveLines(profile: CompanyProfile | null | undefined): string[] {
  const lines: string[] = [];
  const texts = [profile?.business_summary, profile?.outlook].filter(
    (text): text is string => Boolean(text)
  );
  for (const text of texts) {
    for (const sentence of sentencesOf(text)) {
      if (/\bcompet/i.test(sentence) && !lines.includes(sentence)) {
        lines.push(sentence);
      }
      if (lines.length >= 3) break;
    }
    if (lines.length >= 3) break;
  }
  for (const headline of profile?.risk_headlines ?? []) {
    if (/\bcompet|industry|market\b/i.test(headline)) {
      const line = `Named risk category: ${headline}`;
      if (!lines.includes(line)) lines.push(line);
    }
  }
  return lines.slice(0, 5);
}

/**
 * Takes a finished run. Returns the report model, every section derived
 * from data already in hand: nothing here fetches.
 */
export function buildReportModel(run: RunResult): ReportModel {
  const profile = run.response.profile;
  const records = run.response.records;
  const name = prettyName(profile?.name || run.response.entity);
  const financials = profile?.financials ?? {};

  const factLine = [
    profile?.ticker,
    profile?.exchange,
    profile?.industry,
    profile?.city && profile?.state ? `${profile.city}, ${profile.state}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const executiveSummary = [
    financeSentence(name, profile),
    identitySentence(profile),
    rdGrowthSentence(financials),
    evidenceSentence(records),
  ].filter(Boolean);

  const financialYears = [
    ...new Set(
      Object.values(financials).flatMap((series) => Object.keys(series))
    ),
  ].sort();

  const financialRows: ReportFinancialRow[] = METRIC_LABELS.map(
    ([metric, label]) => ({
      metric,
      label,
      values: financialYears
        .filter((year) => financials[metric]?.[year] != null)
        .map((year) => ({ year, value: financials[metric][year] })),
    })
  ).filter((row) => row.values.length > 0);

  const byDateDesc = (a: PipelineRecord, b: PipelineRecord) =>
    b.date.localeCompare(a.date);
  const ofType = (type: string, limit: number) =>
    records.filter((r) => r.record_type === type).sort(byDateDesc).slice(0, limit);

  const sources: string[] = [];
  const seen = new Set<string>();
  for (const record of records) {
    for (const url of [record.url, ...(record.sources ?? [])]) {
      if (url && !seen.has(url)) {
        seen.add(url);
        sources.push(url);
      }
    }
  }

  const profitability = profitabilityLines(financials);

  return {
    name,
    ticker: profile?.ticker || run.response.ticker || "",
    factLine,
    executiveSummary,
    business: profile?.business_summary ?? "",
    strategic: strategicSignals(profile, records, financials),
    revenueTrajectory: revenueTrajectoryRows(financials),
    profitability: profitability.lines,
    profitabilityYear: profitability.year,
    financialYears,
    financialRows,
    rdSentence: rdGrowthSentence(financials),
    workforce: workforceSentence(profile),
    competitive: competitiveLines(profile),
    riskHeadlines: profile?.risk_headlines ?? [],
    filings: (profile?.filings ?? []).map((filing) => ({
      form: filing.form,
      filed: filing.filed,
      url: filing.url,
    })),
    papers: ofType("paper", 5),
    trials: ofType("trial", 5),
    grants: ofType("grant", 5),
    outlook: profile?.outlook ?? "",
    leadership: profile?.leadership ?? [],
    sources,
    generatedFrom:
      "SEC EDGAR, OpenAlex, ClinicalTrials.gov, and NIH RePORTER. " +
      "No language model was used; narrative text is the company's own filings.",
  };
}

/** Takes a record. Returns its one-line markdown listing. */
function recordLine(record: PipelineRecord): string {
  const when = record.date ? ` (${record.date})` : "";
  return `- [${record.title}](${record.url})${when}`;
}

/**
 * Takes a report model. Returns the full report as a markdown document,
 * section for section the same as the page renders.
 */
export function companyReportMarkdown(model: ReportModel): string {
  const lines: string[] = [`# ${model.name}: Company Deep Dive`, ""];
  if (model.factLine) lines.push(model.factLine, "");

  lines.push("## Executive Summary", "", model.executiveSummary.join(" "), "");

  if (model.business) {
    lines.push("## Company Overview", "", model.business, "",
               "*The company's own words, from its latest annual report.*", "");
  }

  if (model.strategic.length > 0) {
    lines.push("## Strategic Direction", "");
    for (const signal of model.strategic) {
      lines.push(`**${signal.heading}.** ${signal.text}`, "");
    }
    lines.push("*Signals derived from the company's own spending, research output, and filings.*", "");
  }

  if (model.revenueTrajectory.length > 0 || model.financialRows.length > 0) {
    lines.push("## Business Model & Financial Performance", "");
  }

  if (model.revenueTrajectory.length > 0) {
    lines.push("### Revenue Trajectory", "");
    lines.push("| Fiscal Year | Revenue | YoY Growth |");
    lines.push("|---|---|---|");
    for (const row of model.revenueTrajectory) {
      const growth = row.yoyPct == null ? "—" : signedPct(row.yoyPct);
      lines.push(`| FY${row.year} | ${reportMoney(row.revenue)} | ${growth} |`);
    }
    lines.push("", "*Source: XBRL financial facts from the company's SEC filings.*", "");
  }

  if (model.profitability.length > 0) {
    lines.push(`### FY${model.profitabilityYear} Profitability`, "");
    lines.push("| Metric | Value |", "|---|---|");
    for (const line of model.profitability) {
      lines.push(`| ${line.label} | ${line.value} |`);
    }
    lines.push("");
  }

  if (model.financialRows.length > 0) {
    lines.push("### Financial History", "");
    lines.push(`| Metric | ${model.financialYears.join(" | ")} |`);
    lines.push(`|---|${model.financialYears.map(() => "---|").join("")}`);
    for (const row of model.financialRows) {
      const cells = model.financialYears.map((year) => {
        const entry = row.values.find((v) => v.year === year);
        return entry ? reportMoney(entry.value) : "";
      });
      lines.push(`| ${row.label} | ${cells.join(" | ")} |`);
    }
    lines.push("");
    if (model.rdSentence) lines.push(model.rdSentence, "");
  }

  const signals = [
    ["Research Papers", model.papers],
    ["Clinical Trials", model.trials],
    ["Federal Grants", model.grants],
  ] as const;
  if (signals.some(([, records]) => records.length > 0)) {
    lines.push("## Research, Partnerships & Pipeline", "");
    for (const [label, records] of signals) {
      if (records.length === 0) continue;
      lines.push(`### ${label}`, "");
      for (const record of records) lines.push(recordLine(record));
      lines.push("");
    }
  }

  if (model.workforce) {
    lines.push("## Hiring & Workforce Signals", "", model.workforce, "",
               "*From the company's own filings.*", "");
  }

  if (model.competitive.length > 0) {
    lines.push("## Competitive Positioning", "");
    for (const line of model.competitive) lines.push(`- ${line}`);
    lines.push("", "*In the company's own words, from its latest filings.*", "");
  }

  if (model.riskHeadlines.length > 0) {
    lines.push("## Key Risks, As the Company Names Them", "");
    for (const headline of model.riskHeadlines) lines.push(`- ${headline}`);
    lines.push("");
  }

  if (model.outlook) {
    lines.push("## Outlook", "", model.outlook, "",
               "*From management's discussion in the latest annual report.*", "");
  }

  if (model.filings.length > 0) {
    lines.push("## Recent SEC Filings", "");
    for (const filing of model.filings) {
      lines.push(`- [${filing.form}](${filing.url}), filed ${filing.filed}`);
    }
    lines.push("");
  }

  if (model.leadership.length > 0) {
    lines.push("## Leadership", "");
    for (const leader of model.leadership) {
      lines.push(`- **${leader.name}**, ${leader.title}`);
    }
    lines.push("", "*Named officers from recent SEC Form 4 filings.*", "");
  }

  lines.push("## Sources", "");
  model.sources.forEach((url, index) => lines.push(`${index + 1}. ${url}`));
  lines.push("", `*${model.generatedFrom}*`, "");
  return lines.join("\n");
}

/**
 * Takes a report model. Returns the report as word-compatible html. saved
 * with an application/msword type, word and pages open it as a styled
 * document; this is how the report exports to word with no dependency.
 */
export function companyReportWordHtml(model: ReportModel): string {
  const esc = (text: string) =>
    text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts: string[] = [
    `<html><head><meta charset="utf-8"><title>${esc(model.name)}: Company Deep Dive</title>`,
    `<style>body{font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:680px;margin:40px auto;line-height:1.5}`,
    `h1{font-size:26px}h2{font-size:18px;margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:4px}`,
    `h3{font-size:15px;margin-top:18px}`,
    `table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;font-size:13px;text-align:right}`,
    `th:first-child,td:first-child{text-align:left}p.meta{color:#6e6e73;font-size:12px}</style></head><body>`,
    `<h1>${esc(model.name)}: Company Deep Dive</h1>`,
    model.factLine ? `<p class="meta">${esc(model.factLine)}</p>` : "",
    `<h2>Executive Summary</h2><p>${esc(model.executiveSummary.join(" "))}</p>`,
  ];

  if (model.business) {
    parts.push(`<h2>Company Overview</h2><p>${esc(model.business)}</p>`);
  }

  if (model.strategic.length > 0) {
    parts.push(`<h2>Strategic Direction</h2>` +
      model.strategic.map((signal) =>
        `<p><b>${esc(signal.heading)}.</b> ${esc(signal.text)}</p>`
      ).join(""));
  }

  if (model.revenueTrajectory.length > 0 || model.financialRows.length > 0) {
    parts.push(`<h2>Business Model &amp; Financial Performance</h2>`);
  }

  if (model.revenueTrajectory.length > 0) {
    const rows = model.revenueTrajectory
      .map((row) =>
        `<tr><td>FY${esc(row.year)}</td><td>${reportMoney(row.revenue)}</td>` +
        `<td>${row.yoyPct == null ? "—" : signedPct(row.yoyPct)}</td></tr>`
      )
      .join("");
    parts.push(`<h3>Revenue Trajectory</h3>` +
      `<table><tr><th>Fiscal Year</th><th>Revenue</th><th>YoY Growth</th></tr>${rows}</table>`);
  }

  if (model.profitability.length > 0) {
    const rows = model.profitability
      .map((line) => `<tr><td>${esc(line.label)}</td><td>${esc(line.value)}</td></tr>`)
      .join("");
    parts.push(`<h3>FY${esc(model.profitabilityYear)} Profitability</h3>` +
      `<table><tr><th>Metric</th><th>Value</th></tr>${rows}</table>`);
  }

  if (model.financialRows.length > 0) {
    const header = model.financialYears.map((y) => `<th>${y}</th>`).join("");
    const rows = model.financialRows
      .map((row) => {
        const cells = model.financialYears
          .map((year) => {
            const entry = row.values.find((v) => v.year === year);
            return `<td>${entry ? reportMoney(entry.value) : ""}</td>`;
          })
          .join("");
        return `<tr><td>${esc(row.label)}</td>${cells}</tr>`;
      })
      .join("");
    parts.push(`<h3>Financial History</h3>` +
      `<table><tr><th>Metric</th>${header}</tr>${rows}</table>`);
    if (model.rdSentence) parts.push(`<p>${esc(model.rdSentence)}</p>`);
  }

  if (model.workforce) {
    parts.push(`<h2>Hiring &amp; Workforce Signals</h2><p>${esc(model.workforce)}</p>`);
  }

  if (model.competitive.length > 0) {
    parts.push(`<h2>Competitive Positioning</h2><ul>` +
      model.competitive.map((line) => `<li>${esc(line)}</li>`).join("") + `</ul>`);
  }

  if (model.riskHeadlines.length > 0) {
    parts.push(`<h2>Key Risks</h2><ul>` +
      model.riskHeadlines.map((h) => `<li>${esc(h)}</li>`).join("") + `</ul>`);
  }

  if (model.outlook) {
    parts.push(`<h2>Outlook</h2><p>${esc(model.outlook)}</p>`);
  }

  if (model.filings.length > 0) {
    parts.push(`<h2>Recent SEC Filings</h2><ul>` +
      model.filings.map((f) =>
        `<li><a href="${esc(f.url)}">${esc(f.form)}</a>, filed ${esc(f.filed)}</li>`
      ).join("") + `</ul>`);
  }

  if (model.leadership.length > 0) {
    parts.push(`<h2>Leadership</h2><ul>` +
      model.leadership.map((l) =>
        `<li><b>${esc(l.name)}</b>, ${esc(l.title)}</li>`).join("") + `</ul>`);
  }

  parts.push(`<h2>Sources</h2><ol>` +
    model.sources.map((u) => `<li>${esc(u)}</li>`).join("") + `</ol>`);
  parts.push(`<p class="meta">${esc(model.generatedFrom)}</p></body></html>`);
  return parts.join("");
}
