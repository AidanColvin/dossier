// Refreshes the cached homepage ledes in lib/startHere.data.ts from the live
// backend. Run on a nightly cron or before a release so the homepage stays
// current without fetching companies on every load.
//
// Usage: node scripts/refreshStartHere.mjs
//
// This mirrors lib/summary/pickHeadline.ts. Keep the two in step: this script
// is plain ESM so it can run in CI without a TypeScript build step.

import { writeFileSync } from "node:fs";

const BACKEND =
  process.env.PIPELINE_API_URL ?? "https://dossier-api-kappa.vercel.app";

const COMPANIES = [
  { ticker: "AAPL", label: "Apple" },
  { ticker: "MRNA", label: "Moderna" },
  { ticker: "NVDA", label: "NVIDIA" },
];

const SUFFIX = { CORP: "Corp", INC: "Inc", CO: "Co", HOLDINGS: "Holdings" };
const KEEP = new Set(["NVIDIA", "IBM", "AMD", "SAP"]);

/** Takes an EDGAR name. Returns a display form. */
function prettyName(name) {
  return name
    .split(/\s+/)
    .map((word) => {
      const bare = word.replace(/[.,]/g, "");
      const upper = bare.toUpperCase();
      if (SUFFIX[upper]) return SUFFIX[upper];
      if (KEEP.has(upper)) return bare;
      if (word !== word.toUpperCase()) return word;
      if (bare.length <= 2) return bare;
      return bare.charAt(0) + bare.slice(1).toLowerCase();
    })
    .join(" ");
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const SUBSTANTIVE_FORMS = new Set([
  "10-K", "10-Q", "8-K", "DEF 14A", "S-1", "S-3", "S-4", "6-K", "20-F", "424B4",
]);
const FORM_LABEL = {
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

/** Takes an ISO date. Returns "Month Year", the bare year, or "". */
function humanDate(iso) {
  const year = Number(String(iso).slice(0, 4));
  if (!Number.isFinite(year) || year < 1900) return "";
  const month = Number(String(iso).slice(5, 7));
  if (!month || month < 1 || month > 12) return String(year);
  return `${MONTHS[month - 1]} ${year}`;
}

/** Takes a title and a max length. Returns it truncated at a word boundary. */
function truncateTitle(title, max = 100) {
  if (title.length <= max) return title;
  const cut = title.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

/** Takes a record. Returns whether it counts as real activity. */
function isSubstantive(record) {
  if (record.record_type !== "filing") return true;
  const form = typeof record.extra?.form === "string" ? record.extra.form.toUpperCase() : "";
  return SUBSTANTIVE_FORMS.has(form);
}

/** Takes one record. Returns the plain-language sentence naming it. */
function phrase(record) {
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

/** Takes an entity and its records. Returns the one or two sentence lede. */
function generateLede(entity, records) {
  if (records.length === 0) return `${entity} has no public records across the four sources searched.`;
  if (records.length === 1) return `${entity}'s only public record is ${truncateTitle(records[0].title)}.`;

  const byDateDesc = (a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0);
  const substantive = records.filter(isSubstantive).sort(byDateDesc);
  const pool = substantive.length > 0 ? substantive : [...records].sort(byDateDesc);

  const primary = pool[0];
  const secondary = pool.slice(1).find((r) => r.record_type !== primary.record_type);
  const sentences = [phrase(primary)];
  if (secondary) sentences.push(phrase(secondary));
  return sentences.join(" ");
}

/** Fetches every company and writes the cached data module. */
async function main() {
  const rows = [];
  for (const c of COMPANIES) {
    const res = await fetch(`${BACKEND}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entity: c.ticker, ticker: c.ticker, max_results: 25 }),
    });
    const data = await res.json();
    const name = prettyName(data.profile?.name || c.label);
    rows.push({
      ticker: c.ticker,
      name,
      industry: data.profile?.industry ?? "",
      lede: generateLede(name, data.records ?? []),
    });
  }

  const body = `// Cached lede sentences for the homepage "start here" grid.
//
// Generated by scripts/refreshStartHere.mjs from the live backend so the
// homepage never fetches companies on load. Regenerate on a nightly cron or
// before a release. Do not edit by hand.

import type { StartHereCard } from "./startHere.types";

export const START_HERE: StartHereCard[] = ${JSON.stringify(rows, null, 2)};
`;
  writeFileSync(new URL("../lib/startHere.data.ts", import.meta.url), body);
  console.log(`Wrote ${rows.length} cards to lib/startHere.data.ts`);
}

main();
