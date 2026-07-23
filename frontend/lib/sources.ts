// one place describing every connector: its display name, its brand colour,
// what it actually returns, and where the data comes from. the source chips,
// the analytics bars, the record rails, and the Sources page all read from
// here, so adding a connector means editing this file and nothing else.

export interface SourceMeta {
  /** the key the api uses (matches registry.available_sources()). */
  key: string;
  label: string;
  /** css custom property holding this source's hue. */
  colorVar: string;
  /** what kind of records it yields. */
  yields: string;
  blurb: string;
  home: string;
  /** the public api endpoint the connector talks to. */
  endpoint: string;
  /** whether the upstream api needs a key - all four are keyless by design. */
  keyless: boolean;
}

export const SOURCES: SourceMeta[] = [
  {
    key: "sec_edgar",
    label: "SEC EDGAR",
    colorVar: "--src-sec",
    yields: "filings",
    blurb:
      "Company filings from the U.S. Securities and Exchange Commission - 10-K, 10-Q, 8-K and the rest, resolved from ticker to CIK.",
    home: "https://www.sec.gov/edgar",
    endpoint: "data.sec.gov/submissions",
    keyless: true,
  },
  {
    key: "openalex",
    label: "OpenAlex",
    colorVar: "--src-openalex",
    yields: "papers",
    blurb:
      "An open catalogue of scholarly works, authors and institutions. Used to surface research output affiliated with the entity.",
    home: "https://openalex.org",
    endpoint: "api.openalex.org/works",
    keyless: true,
  },
  {
    key: "clinicaltrials",
    label: "ClinicalTrials.gov",
    colorVar: "--src-trials",
    yields: "trials",
    blurb:
      "The NIH registry of clinical studies. Matches the entity as a sponsor or collaborator on interventional and observational trials.",
    home: "https://clinicaltrials.gov",
    endpoint: "clinicaltrials.gov/api/v2/studies",
    keyless: true,
  },
  {
    key: "nih_reporter",
    label: "NIH RePORTER",
    colorVar: "--src-nih",
    yields: "grants",
    blurb:
      "Federally funded biomedical research projects, including award amounts, activity codes and administering institutes.",
    home: "https://reporter.nih.gov",
    endpoint: "api.reporter.nih.gov/v2/projects/search",
    keyless: true,
  },
];

const BY_KEY = new Map(SOURCES.map((source) => [source.key, source]));

/**
 * given a source key from the api
 * return its metadata, or a neutral fallback when the key is unknown, so an
 * api that grows a new connector never crashes the ui
 */
export function sourceMeta(key: string): SourceMeta {
  return (
    BY_KEY.get(key) ?? {
      key,
      label: key,
      colorVar: "--muted",
      yields: "records",
      blurb: "",
      home: "",
      endpoint: "",
      keyless: true,
    }
  );
}

/**
 * given a source key
 * return a css colour expression usable in a style prop
 */
export function sourceColor(key: string): string {
  return `var(${sourceMeta(key).colorVar})`;
}
