// markdown export for the sector and partnership reports.
//
// mirrors lib/exports.ts for the company dossier: build the whole document
// from data already in the browser, then hand it to the shared download
// helper. nothing is fetched and nothing is invented; every line quotes the
// report it came from.

import type { PartnershipResponse } from "./partnershipTypes";
import type { SectorReport } from "./sectorTypes";

/**
 * given a finished sector report
 * return it as a markdown document with per-company sections and the
 * numbered reference list
 */
export function sectorReportMarkdown(report: SectorReport): string {
  const lines: string[] = [
    `# Sector scan: ${report.sector}`,
    "",
    `${report.overview.companies_ok} of ${report.overview.companies_total} companies profiled in ${report.overview.elapsed_seconds}s. ` +
      `${report.overview.records_total} records, ${report.verification.verified} verified ` +
      `(${Math.round(report.verification.ratio * 100)}%). Company selection: ${report.method}.`,
    "",
  ];

  for (const company of report.companies) {
    lines.push(`## ${company.name || company.ticker} (${company.ticker})`);
    if (!company.ok) {
      lines.push("", `Not profiled: ${company.error}`, "");
      continue;
    }
    const facts = company.facts;
    const factBits = [
      facts.exchange,
      facts.industry,
      facts.city && facts.state ? `${facts.city}, ${facts.state}` : "",
      facts.revenue ? `revenue FY${facts.revenue.year} $${facts.revenue.value.toLocaleString()}` : "",
    ].filter(Boolean);
    if (factBits.length) lines.push("", factBits.join(" | "));
    lines.push("");
    for (const record of company.top_records) {
      lines.push(`- [${record.title}](${record.url}) (${record.source}, ${record.date || "no date"})`);
    }
    lines.push("");
  }

  lines.push("## References", "");
  for (const reference of report.references) {
    lines.push(`${reference.n}. ${reference.url}`);
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * given a finished partnership lookup
 * return it as a markdown document: signals, the four evidence sections,
 * and the talking points ready to paste into an email
 */
export function partnershipMarkdown(data: PartnershipResponse): string {
  const lines: string[] = [
    `# ${data.company} and ${data.institution}`,
    "",
  ];

  if (data.signals.length) {
    lines.push("## Relationship signals", "");
    for (const signal of data.signals) {
      lines.push(`- **${signal.strength}**: ${signal.description}${signal.url ? ` ([source](${signal.url}))` : ""}`);
    }
    lines.push("");
  }

  if (data.filing_mentions.length) {
    lines.push("## Filings that mention it", "");
    for (const mention of data.filing_mentions) {
      lines.push(`- [${mention.form || "Filing"} ${mention.accession}](${mention.url}), filed ${mention.filed}`);
    }
    lines.push("");
  }

  if (data.papers.length) {
    lines.push("## Co-authored research", "");
    for (const paper of data.papers) {
      lines.push(`- [${paper.title}](${paper.url})${paper.journal ? `, ${paper.journal}` : ""} (${paper.date})`);
    }
    lines.push("");
  }

  if (data.trials.length) {
    lines.push("## Trials involving both", "");
    for (const trial of data.trials) {
      lines.push(`- [${trial.nct_id}: ${trial.title}](${trial.url}), ${trial.is_joint ? "named collaborator" : "overlap"}, ${trial.status}`);
    }
    lines.push("");
  }

  if (data.faculty_leads.length) {
    lines.push("## Funded researchers to contact", "");
    for (const lead of data.faculty_leads) {
      const funded = lead.award_amount ? `, $${lead.award_amount.toLocaleString()}` : "";
      lines.push(`- ${lead.pi_names.join(", ") || "Project team"}: [${lead.title}](${lead.url}) (${lead.project_num}, FY${lead.fiscal_year}${funded})`);
    }
    lines.push("");
  }

  lines.push("## Talking points", "");
  for (const point of data.talking_points) {
    lines.push(`- [${point.category}] **${point.headline}**`);
    if (point.detail) lines.push(`  - ${point.detail}`);
  }
  lines.push("");
  return lines.join("\n");
}
