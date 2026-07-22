// Picks the one real thing a company is actually doing, named plainly, rather
// than describing the shape of the record set. A reader does not care that
// there are "93 records across four sources spanning 1999 to 2026"; that is
// bookkeeping about the tool's own index, not an answer. They care what the
// company is doing, so this names the most recent substantive activity by its
// real title. Pure and deterministic: no randomness, no language model.

import type { PipelineRecord } from "@/lib/types";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// SEC forms that carry real news: an annual report, a material event, a proxy
// vote. Ownership disclosures (3, 4, 5), short position filings (SC 13G/13D),
// and routine plan filings (11-K) are paperwork, not activity, so they are
// excluded from what counts as "substantive."
const SUBSTANTIVE_FORMS = new Set([
  "10-K", "10-Q", "8-K", "DEF 14A", "S-1", "S-3", "S-4", "6-K", "20-F", "424B4",
]);

const FORM_LABEL: Record<string, string> = {
  "10-K": "annual report",
  "10-Q": "quarterly report",
  "8-K": "current report",
  "DEF 14A": "proxy statement",
  "S-1": "registration statement",
  "S-3": "registration statement",
  "S-4": "merger registration",
  "6-K": "foreign issuer report",
  "20-F": "annual report",
};

/** Takes an ISO date. Returns "Month Year", or the bare year, or "". */
function humanDate(iso: string): string {
  const year = Number(iso.slice(0, 4));
  if (!Number.isFinite(year) || year < 1900) return "";
  const month = Number(iso.slice(5, 7));
  if (!month || month < 1 || month > 12) return String(year);
  return `${MONTHS[month - 1]} ${year}`;
}

/**
 * Takes a title and a maximum length. Returns it unchanged if short enough,
 * otherwise cut at the last word boundary before the limit, so a long paper
 * title never runs the lede into an unreadable line.
 */
function truncateTitle(title: string, max = 100): string {
  if (title.length <= max) return title;
  const cut = title.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

/**
 * Takes a record. Returns whether it counts as real activity rather than
 * paperwork. Trials, grants, and papers always do; a filing does only when its
 * form is one that carries actual news.
 */
function isSubstantive(record: PipelineRecord): boolean {
  if (record.record_type !== "filing") return true;
  const form = typeof record.extra?.form === "string" ? record.extra.form.toUpperCase() : "";
  return SUBSTANTIVE_FORMS.has(form);
}

/** Takes one record. Returns the plain-language sentence naming it. */
function phrase(record: PipelineRecord): string {
  const title = truncateTitle(record.title);
  const when = humanDate(record.date);

  switch (record.record_type) {
    case "trial":
      return `Its most recent clinical trial is ${title}${when ? `, begun ${when}` : ""}.`;
    case "grant":
      return `Its most recent NIH grant funds ${title}${when ? ` (${when})` : ""}.`;
    case "paper":
      return `Its researchers most recently published on ${title}${when ? `, in ${when}` : ""}.`;
    case "filing":
    default: {
      const form = typeof record.extra?.form === "string" ? record.extra.form : "";
      const label = FORM_LABEL[form.toUpperCase()] ?? (form ? `${form} filing` : "filing");
      const named = form ? `a ${label} (${form})` : "a filing";
      return `Its most recent major filing is ${named}${when ? `, ${when}` : ""}.`;
    }
  }
}

/**
 * Takes a record set. Returns one or two sentences naming what the company is
 * actually doing: the single most recent substantive record, plus a second
 * one of a different kind if a recent one exists, so the answer spans more
 * than one register when the data supports it. Falls back to the most recent
 * record of any kind when nothing substantive is on file, and states the
 * empty and single-record cases plainly.
 */
export function pickHeadline(set: { entity: string; records: PipelineRecord[] }): string {
  const { entity, records } = set;

  if (records.length === 0) {
    return `${entity} has no public records across the four sources searched.`;
  }
  if (records.length === 1) {
    return `${entity}'s only public record is ${truncateTitle(records[0].title)}.`;
  }

  const byDateDesc = (a: PipelineRecord, b: PipelineRecord) => b.date.localeCompare(a.date);
  const substantive = records.filter(isSubstantive).sort(byDateDesc);
  const pool = substantive.length > 0 ? substantive : [...records].sort(byDateDesc);

  const primary = pool[0];
  const secondary = pool.slice(1).find((record) => record.record_type !== primary.record_type);

  const sentences = [phrase(primary)];
  if (secondary) sentences.push(phrase(secondary));
  return sentences.join(" ");
}
