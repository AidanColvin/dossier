// the bundled sample sector scan, served when no backend is configured.
//
// the demo replays the same event sequence a live scan streams (resolved,
// progress per company, building, verifying, done), so the sectors page has
// exactly one rendering path and the banner is the only difference between
// modes. every url is a real primary source.

import type {
  SectorEventKind,
  SectorProgressEvent,
  SectorReport,
  SectorResolvedEvent,
} from "./sectorTypes";

const SAMPLE_REPORT: SectorReport = {
  sector: "semiconductors",
  query: "semiconductors",
  method: "curated",
  overview: {
    companies_total: 3,
    companies_ok: 3,
    records_total: 24,
    records_by_type: { filing: 9, grant: 3, paper: 9, trial: 3 },
    records_by_source: {
      clinicaltrials: 3,
      nih_reporter: 3,
      openalex: 9,
      sec_edgar: 9,
    },
    elapsed_seconds: 7.4,
  },
  companies: [
    {
      ticker: "NVDA",
      name: "NVIDIA",
      ok: true,
      error: "",
      resolved: true,
      cik: "0001045810",
      record_count: 9,
      facts: {
        exchange: "Nasdaq",
        industry: "Semiconductors & Related Devices",
        city: "Santa Clara",
        state: "CA",
        revenue: { year: "2025", value: 130497000000 },
        net_income: { year: "2025", value: 72880000000 },
      },
      sources: [
        { source: "sec_edgar", ok: true, error: "", count: 3 },
        { source: "openalex", ok: true, error: "", count: 3 },
        { source: "clinicaltrials", ok: true, error: "", count: 1 },
        { source: "nih_reporter", ok: true, error: "", count: 2 },
      ],
      top_records: [
        {
          source: "sec_edgar",
          record_type: "filing",
          title: "10-K filed 2025-02-26",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=10-K",
          date: "2025-02-26",
          verified: true,
        },
        {
          source: "openalex",
          record_type: "paper",
          title: "GPU-accelerated deep learning inference at datacenter scale",
          url: "https://openalex.org/works?filter=institutions.id:I4210131549",
          date: "2024-11-04",
          verified: true,
        },
        {
          source: "nih_reporter",
          record_type: "grant",
          title: "Accelerated computing for biomedical imaging pipelines",
          url: "https://reporter.nih.gov/search",
          date: "2024-08-15",
          verified: true,
        },
      ],
    },
    {
      ticker: "AMD",
      name: "Advanced Micro Devices",
      ok: true,
      error: "",
      resolved: true,
      cik: "0000002488",
      record_count: 8,
      facts: {
        exchange: "Nasdaq",
        industry: "Semiconductors & Related Devices",
        city: "Santa Clara",
        state: "CA",
        revenue: { year: "2024", value: 25785000000 },
        net_income: { year: "2024", value: 1641000000 },
      },
      sources: [
        { source: "sec_edgar", ok: true, error: "", count: 3 },
        { source: "openalex", ok: true, error: "", count: 3 },
        { source: "clinicaltrials", ok: true, error: "", count: 1 },
        { source: "nih_reporter", ok: true, error: "", count: 1 },
      ],
      top_records: [
        {
          source: "sec_edgar",
          record_type: "filing",
          title: "10-K filed 2025-01-29",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000002488&type=10-K",
          date: "2025-01-29",
          verified: true,
        },
        {
          source: "openalex",
          record_type: "paper",
          title: "Chiplet architectures for scalable high-performance computing",
          url: "https://openalex.org/works?filter=institutions.id:I2250653659",
          date: "2024-09-12",
          verified: true,
        },
      ],
    },
    {
      ticker: "INTC",
      name: "Intel",
      ok: true,
      error: "",
      resolved: true,
      cik: "0000050863",
      record_count: 7,
      facts: {
        exchange: "Nasdaq",
        industry: "Semiconductors & Related Devices",
        city: "Santa Clara",
        state: "CA",
        revenue: { year: "2024", value: 53101000000 },
        net_income: { year: "2024", value: -18756000000 },
      },
      sources: [
        { source: "sec_edgar", ok: true, error: "", count: 3 },
        { source: "openalex", ok: true, error: "", count: 3 },
        { source: "clinicaltrials", ok: true, error: "", count: 1 },
        { source: "nih_reporter", ok: false, error: "no awardee match", count: 0 },
      ],
      top_records: [
        {
          source: "sec_edgar",
          record_type: "filing",
          title: "10-K filed 2025-01-31",
          url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000050863&type=10-K",
          date: "2025-01-31",
          verified: true,
        },
        {
          source: "openalex",
          record_type: "paper",
          title: "Advanced packaging and heterogeneous integration research",
          url: "https://openalex.org/works?filter=institutions.id:I79589977",
          date: "2024-10-21",
          verified: true,
        },
      ],
    },
  ],
  verification: {
    verified: 21,
    total: 24,
    ratio: 0.875,
  },
  references: [
    { n: 1, url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=10-K" },
    { n: 2, url: "https://openalex.org/works?filter=institutions.id:I4210131549" },
    { n: 3, url: "https://reporter.nih.gov/search" },
    { n: 4, url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000002488&type=10-K" },
    { n: 5, url: "https://openalex.org/works?filter=institutions.id:I2250653659" },
    { n: 6, url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000050863&type=10-K" },
    { n: 7, url: "https://openalex.org/works?filter=institutions.id:I79589977" },
  ],
};

/**
 * given nothing
 * return the demo scan as an ordered (kind, payload, delayMs) sequence that
 * mirrors what a live backend streams
 */
export function sampleSectorEvents(): Array<{
  kind: SectorEventKind;
  payload: SectorResolvedEvent | SectorProgressEvent | SectorReport | Record<string, never>;
  delayMs: number;
}> {
  const tickers = SAMPLE_REPORT.companies.map((c) => c.ticker);
  const resolved: SectorResolvedEvent = {
    sector: SAMPLE_REPORT.sector,
    method: SAMPLE_REPORT.method,
    total: tickers.length,
    tickers,
  };
  const progress = tickers.map((ticker, index) => ({
    kind: "progress" as const,
    payload: {
      done: index + 1,
      total: tickers.length,
      ticker,
      ok: true,
    } satisfies SectorProgressEvent,
    delayMs: 450,
  }));
  return [
    { kind: "resolved", payload: resolved, delayMs: 300 },
    ...progress,
    { kind: "building", payload: {}, delayMs: 350 },
    { kind: "verifying", payload: {}, delayMs: 350 },
    { kind: "done", payload: SAMPLE_REPORT, delayMs: 250 },
  ];
}
