"use client";

// the partnership intelligence page at /partnerships. name a company and any
// research institution; the pipeline finds their real, sourced links:
// co-authored papers, trials, funded projects, and filing mentions, plus
// ranked talking points for outreach.

import { useCallback, useState } from "react";
import { PageHead } from "@/components/ui";
import { PartnershipView } from "@/components/partnerships/PartnershipView";
import { SaveToProject } from "@/components/shared/SaveToProject";
import type { PartnershipResponse } from "@/lib/partnershipTypes";
import type { RunMode } from "@/lib/types";

const EXAMPLE = { company: "NVDA", institution: "UNC" };

export default function PartnershipsPage() {
  const [company, setCompany] = useState("");
  const [institution, setInstitution] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PartnershipResponse | null>(null);
  const [mode, setMode] = useState<RunMode | null>(null);
  const [error, setError] = useState("");

  const lookup = useCallback(async (companyText: string, institutionText: string) => {
    if (!companyText.trim() || !institutionText.trim()) return;
    setLoading(true);
    setError("");
    setData(null);
    try {
      const response = await fetch(
        `/partnership?company=${encodeURIComponent(companyText)}` +
          `&institution=${encodeURIComponent(institutionText)}`
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { detail?: string };
        throw new Error(body.detail ?? `lookup failed (${response.status})`);
      }
      setMode(response.headers.get("x-dossier-mode") === "live" ? "live" : "demo");
      setData((await response.json()) as PartnershipResponse);
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main className="page page--wide">
      <div className="canvas">
        <PageHead title="Partnership intelligence">
          Name a company and a research institution. Get their real links:
          co-authored papers, joint trials, funded projects, and the company's
          own filings, with talking points ready to send.
        </PageHead>

        <form
          className="row"
          style={{ gap: 8, flexWrap: "wrap" }}
          onSubmit={(event) => {
            event.preventDefault();
            void lookup(company, institution);
          }}
        >
          <input
            type="text"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            placeholder="Company (name or ticker)"
            aria-label="Company"
            maxLength={80}
            style={{ flex: 1, minWidth: 180 }}
          />
          <input
            type="text"
            value={institution}
            onChange={(event) => setInstitution(event.target.value)}
            placeholder="Institution (UNC, MIT, Stanford...)"
            aria-label="Institution"
            maxLength={120}
            style={{ flex: 1, minWidth: 180 }}
          />
          <button type="submit" className="button" disabled={loading}>
            {loading ? "Searching" : "Find links"}
          </button>
        </form>

        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          <button
            type="button"
            className="chip"
            disabled={loading}
            onClick={() => {
              setCompany(EXAMPLE.company);
              setInstitution(EXAMPLE.institution);
              void lookup(EXAMPLE.company, EXAMPLE.institution);
            }}
          >
            try {EXAMPLE.company} + {EXAMPLE.institution}
          </button>
        </div>

        {error && <p className="notice notice--error">{error}</p>}

        {loading && (
          <p className="count-line" aria-live="polite" style={{ marginTop: 16 }}>
            Checking papers, trials, grants, and filings
          </p>
        )}

        {data && mode === "demo" && (
          <p className="notice notice--info" style={{ marginTop: 16 }}>
            No pipeline backend is configured, so this is the bundled sample
            lookup. Connect PIPELINE_API_URL for live data.
          </p>
        )}

        {data && (
          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
              <SaveToProject
                bundle={{
                  name: `${data.company} + ${data.institution}`,
                  mode: "partnership",
                  subject: `${data.company} and ${data.institution}`,
                  partnership: data,
                }}
              />
            </div>
            <PartnershipView data={data} />
          </div>
        )}
      </div>
    </main>
  );
}
