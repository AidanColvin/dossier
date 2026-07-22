// display helpers: map machine names to human labels and pull the useful
// chips out of each record's source-specific extra fields.
import type { PipelineRecord } from "./types";

export const RECORD_TYPES = ["filing", "paper", "trial", "grant"] as const;

const TYPE_LABELS: Record<string, string> = {
  filing: "SEC Filings",
  paper: "Research Papers",
  trial: "Clinical Trials",
  grant: "NIH Grants",
};

const SOURCE_LABELS: Record<string, string> = {
  sec_edgar: "SEC EDGAR",
  openalex: "OpenAlex",
  clinicaltrials: "ClinicalTrials.gov",
  nih_reporter: "NIH RePORTER",
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/**
 * given a date string from any connector
 * return a plain YYYY-MM-DD day, or an em dash when absent
 *
 * upstream APIs are inconsistent: NIH RePORTER returns full ISO timestamps
 * ("1997-07-01T00:00:00") while the others return bare dates. Everything the
 * UI shows is day-resolution, so the time part is dropped rather than leaked
 * into stat tiles and table cells.
 */
export function formatDate(date: string): string {
  if (!date) return "";
  return date.slice(0, 10);
}

// Brand names EDGAR stores in capitals that are genuinely stylized, not just
// an all-caps legal record. These keep their capitalization when a name is
// otherwise title-cased for display.
const KNOWN_CAPS = new Set([
  "NVIDIA",
  "IBM",
  "AMD",
  "SAP",
  "ASML",
  "AECOM",
  "HP",
  "GE",
  "PNC",
  "UPS",
  "ADT",
]);

// EDGAR legal-form suffixes, mapped to a readable form.
const SUFFIX_CASE: Record<string, string> = {
  CORP: "Corp",
  INC: "Inc",
  CO: "Co",
  LP: "LP",
  LLC: "LLC",
  PLC: "PLC",
  NV: "NV",
  SA: "SA",
  AG: "AG",
  HOLDINGS: "Holdings",
  GROUP: "Group",
};

/**
 * Takes an EDGAR company name. Returns a display form: all-caps legal names
 * become title case ("MICROSOFT CORP" to "Microsoft Corp"), while genuine
 * brand capitalizations ("NVIDIA") and short acronyms are preserved.
 */
export function prettyName(name: string): string {
  if (!name) return name;
  return name
    .split(/\s+/)
    .map((word) => {
      const bare = word.replace(/[.,]/g, "");
      const upper = bare.toUpperCase();
      if (SUFFIX_CASE[upper]) return SUFFIX_CASE[upper];
      if (KNOWN_CAPS.has(upper)) return bare;
      // A word that already carries lowercase letters is left as filed, so
      // deliberately mixed names ("eBay") are not flattened.
      if (word !== word.toUpperCase()) return word;
      if (bare.length <= 2) return bare;
      return bare.charAt(0) + bare.slice(1).toLowerCase();
    })
    .join(" ");
}

export function recordChips(record: PipelineRecord): string[] {
  const chips: string[] = [];
  const extra = record.extra ?? {};
  for (const key of ["form", "journal", "status", "organization", "fiscal_year"]) {
    const value = extra[key];
    if (typeof value === "string" && value.trim()) {
      chips.push(value.trim());
    }
  }
  return chips;
}

export function groupByType(
  records: PipelineRecord[]
): Record<string, PipelineRecord[]> {
  const groups: Record<string, PipelineRecord[]> = {};
  for (const record of records) {
    (groups[record.record_type] ??= []).push(record);
  }
  return groups;
}
