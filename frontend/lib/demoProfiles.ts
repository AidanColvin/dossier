// bundled company profiles for demo mode, one per sample entity.
//
// without a backend the sample records used to arrive with no profile, so
// the demo company page had no fact banner, no financial charts, and a lede
// with nothing to say about money. these profiles carry real figures from
// each company's sec filings so the standalone deployment demonstrates the
// full page for every sample company, not just one, honestly labeled as
// sample data by the demo banner. pulled from the live pipeline; refresh
// periodically the same way scripts/refreshStartHere.mjs refreshes the
// homepage cards.

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
      revenue: { "2022": 26914000000, "2023": 26974000000, "2024": 60922000000, "2025": 130497000000, "2026": 215938000000 },
      net_income: { "2022": 9752000000, "2023": 4368000000, "2024": 29760000000, "2025": 72880000000, "2026": 120067000000 },
      research_development: { "2022": 5268000000, "2023": 7339000000, "2024": 8675000000, "2025": 12914000000, "2026": 18497000000 },
      assets: { "2022": 44187000000, "2023": 41182000000, "2024": 65728000000, "2025": 111601000000, "2026": 206803000000 },
      equity: { "2022": 26612000000, "2023": 22101000000, "2024": 42978000000, "2025": 79327000000, "2026": 157293000000 },
    },
    filings: [
      { form: "10-K", filed: "2026-02-25", accession: "0001045810-26-000015",
        url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=10-K" },
      { form: "SCHEDULE 13G", filed: "2026-07-20", accession: "0001045810-26-000062",
        url: "https://www.sec.gov/Archives/edgar/data/1045810/000104581026000062/xslSCHEDULE_13G_X01/primary_doc.xml" },
    ],
    ok: true,
  },

  moderna: {
    name: "Moderna, Inc.",
    cik: "0001682852",
    ticker: "MRNA",
    exchange: "Nasdaq",
    industry: "Biological Products, (No Diagnostic Substances)",
    city: "Cambridge",
    state: "MA",
    website: "https://www.modernatx.com",
    fiscal_year_end: "1231",
    business_summary:
      "Moderna is a pioneer and leader in the field of mRNA medicine. " +
      "Through the advancement of our technology platform, we are " +
      "reimagining how medicines are made to transform how we treat and " +
      "prevent diseases. Since our founding, our mRNA platform has enabled " +
      "the development of vaccine and therapeutic candidates across " +
      "infectious disease, oncology, and rare disease.",
    risk_headlines: [
      "Risks related to commercialization and our products",
      "Risks related to our pipeline, product development and regulatory review",
      "Risks related to the manufacturing of our commercial products and product candidates",
      "Risks related to our reliance on third parties",
      "Risks related to our intellectual property",
      "Risks related to our financial condition and results of operations",
    ],
    outlook: "",
    leadership: [
      { name: "Stephen Hoge", title: "President" },
      { name: "James M Mock", title: "Chief Financial Officer" },
      { name: "Soria Ester Banque", title: "Chief Commercial Officer" },
    ],
    financials: {
      revenue: { "2022": 19263000000, "2023": 6848000000, "2024": 3236000000, "2025": 1944000000 },
      net_income: { "2022": 8362000000, "2023": -4714000000, "2024": -3561000000, "2025": -2822000000 },
      research_development: { "2022": 3295000000, "2023": 4845000000, "2024": 4543000000, "2025": 3132000000 },
      assets: { "2022": 25858000000, "2023": 18426000000, "2024": 14142000000, "2025": 12338000000, "2026": 11488000000 },
      equity: { "2022": 19123000000, "2023": 13854000000, "2024": 10901000000, "2025": 10066000000, "2026": 7408000000 },
    },
    filings: [
      { form: "4", filed: "2026-07-16", accession: "0001682852-26-000141",
        url: "https://www.sec.gov/Archives/edgar/data/1682852/000168285226000141/xslF345X06/form4.xml" },
      { form: "144", filed: "2026-07-15", accession: "0001959173-26-005230",
        url: "https://www.sec.gov/Archives/edgar/data/1682852/000195917326005230/xsl144X01/primary_doc.xml" },
    ],
    ok: true,
  },

  pfizer: {
    name: "PFIZER INC",
    cik: "0000078003",
    ticker: "PFE",
    exchange: "NYSE",
    industry: "Pharmaceutical Preparations",
    city: "New York",
    state: "NY",
    website: "https://www.pfizer.com",
    fiscal_year_end: "1231",
    business_summary:
      "Pfizer is a research-based, global biopharmaceutical company. We " +
      "apply science and our global resources to bring therapies to people " +
      "that extend and significantly improve their lives through the " +
      "discovery, development, manufacture, marketing, sale, and " +
      "distribution of biopharmaceutical products worldwide.",
    risk_headlines: [],
    outlook: "",
    leadership: [
      { name: "Albert Bourla", title: "Chairman & CEO" },
      { name: "Jennifer B. Damico", title: "SVP & Controller" },
    ],
    financials: {
      revenue: { "2022": 91793000000, "2023": 50914000000, "2024": 63627000000, "2025": 62579000000 },
      net_income: { "2022": 31372000000, "2023": 2119000000, "2024": 8031000000, "2025": 7771000000 },
      assets: { "2022": 197205000000, "2023": 226501000000, "2024": 213396000000, "2025": 208160000000, "2026": 207618000000 },
      equity: { "2022": 95661000000, "2023": 89014000000, "2024": 88203000000, "2025": 86476000000, "2026": 90101000000 },
    },
    filings: [
      { form: "4", filed: "2026-07-16", accession: "0001225208-26-006638",
        url: "https://www.sec.gov/Archives/edgar/data/78003/000122520826006638/xslF345X06/doc4.xml" },
      { form: "4", filed: "2026-07-13", accession: "0001225208-26-006587",
        url: "https://www.sec.gov/Archives/edgar/data/78003/000122520826006587/xslF345X06/doc4.xml" },
    ],
    ok: true,
  },

  alphabet: {
    name: "Alphabet Inc.",
    cik: "0001652044",
    ticker: "GOOGL",
    exchange: "Nasdaq",
    industry: "Services-Computer Programming, Data Processing, Etc.",
    city: "Mountain View",
    state: "CA",
    website: "https://abc.xyz",
    fiscal_year_end: "1231",
    business_summary:
      "As our founders Larry and Sergey wrote in the original founders' " +
      "letter, \"Google is not a conventional company. We do not intend to " +
      "become one.\" That unconventional spirit has been a driving force " +
      "throughout our history, inspiring us to tackle big problems and " +
      "invest in moonshots, and led us to be a pioneer in the development " +
      "of artificial intelligence.",
    risk_headlines: ["Risks Specific to our Company"],
    outlook: "",
    leadership: [
      { name: "John Kent Walker", title: "President, Global Affairs, Clo" },
      { name: "Marsida Saraci", title: "VP, Chief Accounting Officer" },
    ],
    financials: {
      revenue: { "2022": 282836000000, "2023": 307394000000, "2024": 350018000000, "2025": 402836000000 },
      net_income: { "2022": 59972000000, "2023": 73795000000, "2024": 100118000000, "2025": 132170000000 },
      research_development: { "2022": 39500000000, "2023": 45427000000, "2024": 49326000000, "2025": 61087000000 },
      assets: { "2022": 365264000000, "2023": 402392000000, "2024": 450256000000, "2025": 595281000000, "2026": 921983000000 },
      equity: { "2022": 256144000000, "2023": 283379000000, "2024": 325084000000, "2025": 345267000000, "2026": 478746000000 },
    },
    filings: [
      { form: "10-Q", filed: "2026-07-23", accession: "0001652044-26-000071",
        url: "https://www.sec.gov/Archives/edgar/data/1652044/000165204426000071/goog-20260630.htm" },
      { form: "S-8", filed: "2026-07-23", accession: "0001193125-26-312805",
        url: "https://www.sec.gov/Archives/edgar/data/1652044/000119312526312805/d60612ds8.htm" },
    ],
    ok: true,
  },

  "eli-lilly": {
    name: "ELI LILLY & Co",
    cik: "0000059478",
    ticker: "LLY",
    exchange: "NYSE",
    industry: "Pharmaceutical Preparations",
    city: "Indianapolis",
    state: "IN",
    website: "https://www.lilly.com",
    fiscal_year_end: "1231",
    business_summary:
      "Eli Lilly and Company was incorporated in 1901 in Indiana to " +
      "succeed to the drug manufacturing business founded in Indianapolis, " +
      "Indiana, in 1876 by Colonel Eli Lilly. We discover, develop, " +
      "manufacture, and market products in a single business segment: " +
      "human pharmaceutical products.",
    risk_headlines: [
      "Risks Related to Our Business and Industry",
      "Risks Related to Our Intellectual Property",
      "Risks Related to Our Operations",
      "Risks Related to Doing Business Internationally",
      "Risks Related to Litigation and Government Regulation",
    ],
    outlook: "",
    leadership: [
      { name: "Ilya Yuffa", title: "EVP&Pres, Lly USA&Global Capab" },
    ],
    financials: {
      revenue: { "2022": 28541400000, "2023": 34124000000, "2024": 45043000000, "2025": 65179000000 },
      net_income: { "2022": 6244800000, "2023": 5240000000, "2024": 10590000000, "2025": 20640000000 },
      research_development: { "2022": 7190800000 },
      assets: { "2022": 49489800000, "2023": 64006300000, "2024": 78715000000, "2025": 112476000000, "2026": 116576000000 },
      equity: { "2022": 10649800000, "2023": 10771900000, "2024": 14272000000, "2025": 26535000000, "2026": 31198000000 },
    },
    filings: [
      { form: "SCHEDULE 13G/A", filed: "2026-07-23", accession: "0000316011-26-000029",
        url: "https://www.sec.gov/Archives/edgar/data/59478/000031601126000029/xslSCHEDULE_13G_X02/primary_doc.xml" },
      { form: "4", filed: "2026-07-21", accession: "0001262388-26-000014",
        url: "https://www.sec.gov/Archives/edgar/data/59478/000126238826000014/xslF345X06/wk-form4_1784666431.xml" },
    ],
    ok: true,
  },

  regeneron: {
    name: "REGENERON PHARMACEUTICALS, INC.",
    cik: "0000872589",
    ticker: "REGN",
    exchange: "Nasdaq",
    industry: "Pharmaceutical Preparations",
    city: "Tarrytown",
    state: "NY",
    website: "https://www.regeneron.com",
    fiscal_year_end: "1231",
    business_summary:
      "Regeneron is a leading biotechnology company that invents " +
      "life-transforming medicines for people with serious diseases. " +
      "Founded and led for over 35 years by physician-scientists, our " +
      "unique ability to repeatedly and consistently translate science " +
      "into medicine has led to numerous approved treatments and a robust " +
      "pipeline of product candidates.",
    risk_headlines: [
      "Immunology & Inflammation",
      "Antibody to IL-6R",
      "Antibody to IL-33",
    ],
    outlook: "",
    leadership: [
      { name: "Jason Pitofsky", title: "SVP Controller" },
    ],
    financials: {
      revenue: { "2022": 12172900000, "2023": 13117200000, "2024": 14202000000, "2025": 14342900000 },
      net_income: { "2022": 4338400000, "2023": 3953600000, "2024": 4412600000, "2025": 4504900000 },
      research_development: { "2022": 3592500000, "2023": 4439000000, "2024": 5132000000, "2025": 5850200000 },
      assets: { "2022": 29214500000, "2023": 33080200000, "2024": 37759400000, "2025": 40558700000, "2026": 40868800000 },
      equity: { "2022": 22664000000, "2023": 25973100000, "2024": 29353600000, "2025": 29387600000, "2026": 31423600000 },
    },
    filings: [
      { form: "4", filed: "2026-07-07", accession: "0001187443-26-000010",
        url: "https://www.sec.gov/Archives/edgar/data/872589/000118744326000010/xslF345X06/edgardoc.xml" },
      { form: "8-K", filed: "2026-07-06", accession: "0001104659-26-080562",
        url: "https://www.sec.gov/Archives/edgar/data/872589/000110465926080562/tm2619682d1_8k.htm" },
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
