// bundled company profiles for demo mode, one per sample entity.
//
// without a backend the sample records used to arrive with no profile, so
// the demo company page had no fact banner, no financial charts, and a lede
// with nothing to say about money. these profiles carry real figures from
// each company's sec filings so the standalone deployment demonstrates the
// full page, honestly labeled as sample data by the demo banner.

import type { CompanyProfile } from "./types";

export const DEMO_PROFILES: Record<string, CompanyProfile> = {
  nvidia: {
    name: "NVIDIA CORP",
    cik: "0001045810",
    ticker: "NVDA",
    exchange: "Nasdaq",
    industry: "Semiconductors & Related Devices",
    city: "Santa Clara",
    state: "CA",
    website: "https://www.nvidia.com",
    fiscal_year_end: "0126",
    business_summary:
      "NVIDIA pioneered accelerated computing to help solve the most " +
      "challenging computational problems. NVIDIA is now a data center scale " +
      "AI infrastructure company reshaping all industries. Our technology " +
      "spans silicon, systems, software, and services, sold to cloud " +
      "providers, enterprises, and researchers in every major market.",
    risk_headlines: [
      "Risks Related to Our Industry and Markets",
      "Risks Related to Demand, Supply, and Manufacturing",
      "Risks Related to Regulatory, Legal, Our Stock, and Other Matters",
    ],
    outlook: "",
    leadership: [
      { name: "Jen Hsun Huang", title: "President and CEO" },
      { name: "Colette M Kress", title: "EVP and Chief Financial Officer" },
      { name: "Timothy S. Teter", title: "EVP and General Counsel" },
    ],
    financials: {
      revenue: { "2021": 16675000000, "2022": 26914000000, "2023": 26974000000, "2024": 60922000000, "2025": 130497000000 },
      net_income: { "2021": 4332000000, "2022": 9752000000, "2023": 4368000000, "2024": 29760000000, "2025": 72880000000 },
      research_development: { "2021": 3924000000, "2022": 5268000000, "2023": 7339000000, "2024": 8675000000, "2025": 12914000000 },
      assets: { "2021": 28791000000, "2022": 44187000000, "2023": 41182000000, "2024": 65728000000, "2025": 111601000000 },
      equity: { "2021": 16893000000, "2022": 26612000000, "2023": 22101000000, "2024": 42978000000, "2025": 79327000000 },
    },
    filings: [
      { form: "10-K", filed: "2025-02-26", accession: "0001045810-25-000023",
        url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=10-K" },
      { form: "10-Q", filed: "2025-05-28", accession: "0001045810-25-000082",
        url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=10-Q" },
    ],
    ok: true,
  },
};

/**
 * given a sample entity slug
 * return its bundled profile, or undefined when the sample has none
 */
export function demoProfile(slug: string): CompanyProfile | undefined {
  return DEMO_PROFILES[slug];
}
