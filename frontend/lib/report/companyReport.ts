// the full company report: one model, three renderings.
//
// buildReportModel derives every section of a board-ready report from a
// finished run: executive summary, the company's own 10-K words, financial
// history, risks, filings, research signals, outlook, leadership, and a
// numbered source list. the page, the markdown download, and the word
// download all render from this one model, so the three can never disagree.
// deterministic throughout: no model, no randomness.

import { financeSentence, identitySentence } from "@/lib/summary/generateLede";
import { prettyName } from "@/lib/format";
import type { PipelineRecord, RunResult } from "@/lib/types";

export interface ReportFinancialRow {
  metric: string;
  label: string;
  values: Array<{ year: string; value: number }>;
}

export interface ReportModel {
  name: string;
  ticker: string;
  factLine: string;
  executiveSummary: string[];
  business: string;
  financialYears: string[];
  financialRows: ReportFinancialRow[];
  rdSentence: string;
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

  return {
    name,
    ticker: profile?.ticker || run.response.ticker || "",
    factLine,
    executiveSummary,
    business: profile?.business_summary ?? "",
    financialYears,
    financialRows,
    rdSentence: rdGrowthSentence(financials),
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
  const lines: string[] = [`# ${model.name}: Company Profile`, ""];
  if (model.factLine) lines.push(model.factLine, "");

  lines.push("## Executive Summary", "", model.executiveSummary.join(" "), "");

  if (model.business) {
    lines.push("## What the Company Does", "", model.business, "",
               "*The company's own words, from its latest annual report.*", "");
  }

  if (model.financialRows.length > 0) {
    lines.push("## Financial Performance", "");
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

  if (model.riskHeadlines.length > 0) {
    lines.push("## Key Risks, As the Company Names Them", "");
    for (const headline of model.riskHeadlines) lines.push(`- ${headline}`);
    lines.push("");
  }

  if (model.filings.length > 0) {
    lines.push("## Recent SEC Filings", "");
    for (const filing of model.filings) {
      lines.push(`- [${filing.form}](${filing.url}), filed ${filing.filed}`);
    }
    lines.push("");
  }

  const signals = [
    ["Research Papers", model.papers],
    ["Clinical Trials", model.trials],
    ["Federal Grants", model.grants],
  ] as const;
  if (signals.some(([, records]) => records.length > 0)) {
    lines.push("## Research and Innovation Signals", "");
    for (const [label, records] of signals) {
      if (records.length === 0) continue;
      lines.push(`### ${label}`, "");
      for (const record of records) lines.push(recordLine(record));
      lines.push("");
    }
  }

  if (model.outlook) {
    lines.push("## Outlook", "", model.outlook, "",
               "*From management's discussion in the latest annual report.*", "");
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
    `<html><head><meta charset="utf-8"><title>${esc(model.name)}: Company Profile</title>`,
    `<style>body{font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:680px;margin:40px auto;line-height:1.5}`,
    `h1{font-size:26px}h2{font-size:18px;margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:4px}`,
    `table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;font-size:13px;text-align:right}`,
    `th:first-child,td:first-child{text-align:left}p.meta{color:#6e6e73;font-size:12px}</style></head><body>`,
    `<h1>${esc(model.name)}: Company Profile</h1>`,
    model.factLine ? `<p class="meta">${esc(model.factLine)}</p>` : "",
    `<h2>Executive Summary</h2><p>${esc(model.executiveSummary.join(" "))}</p>`,
  ];

  if (model.business) {
    parts.push(`<h2>What the Company Does</h2><p>${esc(model.business)}</p>`);
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
    parts.push(`<h2>Financial Performance</h2>` +
      `<table><tr><th>Metric</th>${header}</tr>${rows}</table>`);
    if (model.rdSentence) parts.push(`<p>${esc(model.rdSentence)}</p>`);
  }

  if (model.riskHeadlines.length > 0) {
    parts.push(`<h2>Key Risks</h2><ul>` +
      model.riskHeadlines.map((h) => `<li>${esc(h)}</li>`).join("") + `</ul>`);
  }

  if (model.filings.length > 0) {
    parts.push(`<h2>Recent SEC Filings</h2><ul>` +
      model.filings.map((f) =>
        `<li><a href="${esc(f.url)}">${esc(f.form)}</a>, filed ${esc(f.filed)}</li>`
      ).join("") + `</ul>`);
  }

  if (model.outlook) {
    parts.push(`<h2>Outlook</h2><p>${esc(model.outlook)}</p>`);
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
