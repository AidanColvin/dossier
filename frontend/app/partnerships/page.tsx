"use client";

// the partnership intelligence page at /partnerships. name a company and any
// research institution; the pipeline finds their real, sourced links:
// co-authored papers, trials, funded projects, and filing mentions, plus
// ranked talking points for outreach.

import { useCallback, useEffect, useRef, useState } from "react";
import { LoadingRows, PageHead } from "@/components/ui";
import { PartnershipView } from "@/components/partnerships/PartnershipView";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { download } from "@/lib/exports";
import { partnershipMarkdown } from "@/lib/reportExport";
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
    // the lookup is bookmarkable: both names land in the url, so a result
    // can be shared as a link and the recipient's visit re-runs it.
    window.history.replaceState(
      null, "",
      `/partnerships?company=${encodeURIComponent(companyText.trim())}` +
        `&institution=${encodeURIComponent(institutionText.trim())}`
    );
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

  // a deep-linked visit (?company=NVDA&institution=UNC) runs its lookup
  // once on mount, reading window.location directly so the page stays
  // statically prerenderable.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const params = new URLSearchParams(window.location.search);
    const linkedCompany = params.get("company");
    const linkedInstitution = params.get("institution");
    if (linkedCompany && linkedInstitution) {
      setCompany(linkedCompany);
      setInstitution(linkedInstitution);
      void lookup(linkedCompany, linkedInstitution);
    }
  }, [lookup]);

  return (
    <main className="page page--wide">
      <div className="canvas">
        <PageHead title="Partnership intelligence">
          Name a company and a research institution. Get their real links:
          co-authored papers, joint trials, funded projects, and the company's
          own filings, with talking points ready to send.
        </PageHead>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void lookup(company, institution);
          }}
        >
          <div className="search-bar">
            <input
              type="text"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Company (name or ticker)"
              aria-label="Company"
              maxLength={80}
            />
            <input
              type="text"
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
              placeholder="Institution (UNC, MIT, Stanford...)"
              aria-label="Institution"
              maxLength={120}
            />
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? "Searching" : "Find links"}
            </button>
          </div>
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
          <div className="stack" style={{ gap: 10, marginTop: 16 }} aria-live="polite">
            <p className="count-line">
              Checking papers, trials, grants, and filings
            </p>
            <LoadingRows rows={4} />
          </div>
        )}

        {data && mode === "demo" && (
          <p className="notice notice--info" style={{ marginTop: 16 }}>
            No pipeline backend is configured, so this is the bundled sample
            lookup. Connect PIPELINE_API_URL for live data.
          </p>
        )}

        {data && (
          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
              <button
                type="button"
                className="chip"
                onClick={() =>
                  download(partnershipMarkdown(data),
                           `${data.ticker || data.company}-partnerships.md`,
                           "text/markdown")
                }
              >
                Download report
              </button>
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
