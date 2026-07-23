"use client";

// the narrative sections of a company profile: the business in the
// company's own 10-K words, its named risk categories, management's
// discussion, and the leadership org chart from form 4 filings. every
// section hides itself when its data is absent, so a shallow run or a
// company without a readable annual report renders nothing here rather
// than empty boxes.

import { OrgChart } from "@/components/Charts";
import type { CompanyProfile } from "@/lib/types";

export function CompanyNarrative({ profile }: { profile?: CompanyProfile | null }) {
  if (!profile) return null;
  const hasNarrative =
    profile.business_summary || profile.outlook ||
    (profile.risk_headlines?.length ?? 0) > 0 ||
    (profile.leadership?.length ?? 0) > 0;
  if (!hasNarrative) return null;

  return (
    <div className="stack" style={{ gap: 16, marginTop: 20 }}>
      {profile.business_summary && (
        <section className="card">
          <h2 className="section-title">What the company says it does</h2>
          <p style={{ margin: "8px 0 4px" }}>{profile.business_summary}</p>
          <p className="count-line">
            The company&apos;s own words, from its latest annual report.
          </p>
        </section>
      )}

      {(profile.leadership?.length ?? 0) > 0 && (
        <section className="card">
          <h2 className="section-title">Leadership</h2>
          <div className="grid grid--3" style={{ marginTop: 8 }}>
            {profile.leadership!.map((leader) => (
              <div key={leader.name} className="stat">
                <div className="stat__value" style={{ fontSize: 16 }}>
                  {leader.name}
                </div>
                <div className="stat__label" style={{ textTransform: "none" }}>
                  {leader.title}
                </div>
              </div>
            ))}
          </div>
          <p className="count-line">
            Named officers from recent SEC Form 4 filings.
          </p>
        </section>
      )}

      {(profile.risk_headlines?.length ?? 0) > 0 && (
        <section className="card">
          <h2 className="section-title">Key risks, as the company names them</h2>
          <ul className="stack" style={{ gap: 4, margin: "8px 0 4px", paddingLeft: 18 }}>
            {profile.risk_headlines!.map((headline) => (
              <li key={headline}>{headline}</li>
            ))}
          </ul>
          <p className="count-line">Risk categories from Item 1A of the latest 10-K.</p>
        </section>
      )}

      {profile.outlook && (
        <section className="card">
          <h2 className="section-title">Management&apos;s discussion</h2>
          <p style={{ margin: "8px 0 4px" }}>{profile.outlook}</p>
          <p className="count-line">
            From Item 7 of the latest annual report.
          </p>
        </section>
      )}
    </div>
  );
}
