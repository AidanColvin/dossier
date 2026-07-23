// the bundled sample partnership lookup, served when no backend is
// configured. real primary-source urls throughout, so every link works.

import type { PartnershipResponse } from "./partnershipTypes";

export const SAMPLE_PARTNERSHIP: PartnershipResponse = {
  company: "NVIDIA",
  company_resolved: true,
  ticker: "NVDA",
  cik: "0001045810",
  institution: "University of North Carolina at Chapel Hill",
  institution_resolved: true,
  papers: [
    {
      title: "GPU-accelerated molecular dynamics for drug discovery",
      url: "https://openalex.org/works?filter=institutions.ror:0130frc33",
      date: "2024-10-02",
      journal: "Journal of Computational Chemistry",
    },
    {
      title: "Deep learning segmentation of clinical imaging at scale",
      url: "https://openalex.org/works?filter=institutions.ror:0130frc33",
      date: "2024-05-18",
      journal: "Medical Image Analysis",
    },
  ],
  trials: [
    {
      nct_id: "NCT05123456",
      title: "AI-guided imaging with academic collaboration",
      status: "RECRUITING",
      date: "2024-06-01",
      url: "https://clinicaltrials.gov/search?term=NVIDIA",
      is_joint: true,
    },
  ],
  faculty_leads: [
    {
      pi_names: ["Jordan Smith", "Alex Chen"],
      department: "GENETICS",
      project_num: "R01GM123456",
      title: "GPU-accelerated genomics with NVIDIA hardware",
      fiscal_year: "2024",
      award_amount: 512345,
      url: "https://reporter.nih.gov/search",
    },
    {
      pi_names: ["Sam Rivera"],
      department: "RADIOLOGY",
      project_num: "R21CA654321",
      title: "Deep learning imaging pilot",
      fiscal_year: "2022",
      award_amount: null,
      url: "https://reporter.nih.gov/search",
    },
  ],
  filing_mentions: [
    {
      form: "10-K",
      filed: "2025-02-26",
      accession: "0001045810-25-000023",
      url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=10-K",
    },
  ],
  signals: [
    {
      strength: "confirmed",
      kind: "filing_mention",
      description:
        "NVIDIA's own 10-K filing mentions University of North Carolina at Chapel Hill (1 filing(s))",
      url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=10-K",
    },
    {
      strength: "confirmed",
      kind: "joint_trial",
      description:
        "University of North Carolina at Chapel Hill is a named collaborator on 1 of NVIDIA's clinical trials",
      url: "https://clinicaltrials.gov/search?term=NVIDIA",
    },
    {
      strength: "probable",
      kind: "coauthorship",
      description:
        "researchers at NVIDIA and University of North Carolina at Chapel Hill co-authored 2 recent paper(s)",
      url: "https://openalex.org/works?filter=institutions.ror:0130frc33",
    },
    {
      strength: "probable",
      kind: "funded_research",
      description:
        "2 federally funded project(s) at University of North Carolina at Chapel Hill name NVIDIA",
      url: "https://reporter.nih.gov/search",
    },
  ],
  talking_points: [
    {
      category: "Existing Relationship",
      headline:
        "NVIDIA's own 10-K filing mentions University of North Carolina at Chapel Hill (1 filing(s))",
      detail:
        "source: https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=10-K",
      strength: "high",
      url: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0001045810&type=10-K",
    },
    {
      category: "Contact",
      headline:
        "Jordan Smith, Alex Chen already works on this: GPU-accelerated genomics with NVIDIA hardware",
      detail: "R01GM123456, funded at $512,345 (FY2024)",
      strength: "high",
      url: "https://reporter.nih.gov/search",
    },
    {
      category: "Research Overlap",
      headline: "joint trial NCT05123456: AI-guided imaging with academic collaboration",
      detail: "status RECRUITING, started 2024-06-01",
      strength: "high",
      url: "https://clinicaltrials.gov/search?term=NVIDIA",
    },
    {
      category: "Partnership Opportunity",
      headline: "co-authored: GPU-accelerated molecular dynamics for drug discovery",
      detail: "Journal of Computational Chemistry",
      strength: "medium",
      url: "https://openalex.org/works?filter=institutions.ror:0130frc33",
    },
  ],
  statuses: [
    { source: "openalex", ok: true, error: "", count: 2 },
    { source: "clinicaltrials", ok: true, error: "", count: 1 },
    { source: "nih_reporter", ok: true, error: "", count: 2 },
    { source: "sec_edgar", ok: true, error: "", count: 1 },
  ],
  elapsed_seconds: 2.1,
};
