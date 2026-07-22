// String helpers and label maps for the summary generators. Kept separate so
// the wording lives in one place and the generators stay about logic.

/** Spelled-out forms for small counts, so "four sources" reads as prose. */
const SMALL_NUMBERS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
];

/** Takes a count. Returns the word for zero to nine, or the digits above nine. */
export function spell(count: number): string {
  return count >= 0 && count < SMALL_NUMBERS.length
    ? SMALL_NUMBERS[count]
    : String(count);
}

/** Takes a count and a singular noun. Returns the noun pluralized to match. */
export function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}

/** Human labels for each source key. */
const SOURCE_LABELS: Record<string, string> = {
  sec_edgar: "SEC EDGAR",
  openalex: "OpenAlex",
  clinicaltrials: "ClinicalTrials.gov",
  nih_reporter: "NIH RePORTER",
};

/** Takes a source key. Returns its display label, or the key when unknown. */
export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

/**
 * Plural nouns describing what each source contributes, used in the second
 * lede sentence ("10 trials", "8 research papers").
 */
const SOURCE_NOUNS: Record<string, string> = {
  sec_edgar: "filing",
  openalex: "research paper",
  clinicaltrials: "trial",
  nih_reporter: "grant",
};

/**
 * Takes a source key and a count. Returns the contribution phrase for that
 * source, for example "10 trials" or "1 filing".
 */
export function contribution(source: string, count: number): string {
  const noun = SOURCE_NOUNS[source] ?? "record";
  return `${count} ${plural(count, noun)}`;
}

/** Singular labels for each record type, for the busiest-year descriptor. */
const TYPE_LABELS: Record<string, string> = {
  filing: "SEC filing",
  paper: "research paper",
  trial: "clinical trial",
  grant: "research grant",
};

/** Takes a record type. Returns a readable singular label. */
export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}
