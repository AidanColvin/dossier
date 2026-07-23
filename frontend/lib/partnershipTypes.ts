// shared types mirroring the partnerships api response shapes.

export interface CoauthoredPaper {
  title: string;
  url: string;
  date: string;
  journal: string;
}

export interface PartnerTrial {
  nct_id: string;
  title: string;
  status: string;
  date: string;
  url: string;
  is_joint: boolean;
}

export interface FacultyLead {
  pi_names: string[];
  department: string;
  project_num: string;
  title: string;
  fiscal_year: string;
  award_amount: number | null;
  url: string;
}

export interface FilingMention {
  form: string;
  filed: string;
  accession: string;
  url: string;
}

export interface RelationshipSignal {
  strength: "confirmed" | "probable";
  kind: string;
  description: string;
  url: string;
}

export interface TalkingPoint {
  category: string;
  headline: string;
  detail: string;
  strength: "high" | "medium" | "low";
  url: string;
}

export interface LookupStatus {
  source: string;
  ok: boolean;
  error: string;
  count: number;
}

export interface PartnershipResponse {
  company: string;
  company_resolved: boolean;
  ticker: string;
  cik: string;
  institution: string;
  institution_resolved: boolean;
  papers: CoauthoredPaper[];
  trials: PartnerTrial[];
  faculty_leads: FacultyLead[];
  filing_mentions: FilingMention[];
  signals: RelationshipSignal[];
  talking_points: TalkingPoint[];
  statuses: LookupStatus[];
  elapsed_seconds: number;
}
