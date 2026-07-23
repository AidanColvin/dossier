"use client";

// Assembles the company page. The lede is the answer; everything here earns its
// place relative to it. No THIS QUARTER strip (deferred until strict OpenAlex
// records can be shown), no revenue or R&D charts (a sentence says it better),
// no duplicate filings table. Every financial number links to its 10-K.

import { useMemo, useState } from "react";
import { CompanyFooter } from "@/components/company/CompanyFooter";
import { CompanyNarrative } from "@/components/company/CompanyNarrative";
import { CompanyHeader } from "@/components/company/CompanyHeader";
import { FinancialCard } from "@/components/company/FinancialCard";
import { LedeParagraph } from "@/components/company/LedeParagraph";
import { RDGrowthSentence } from "@/components/company/RDGrowthSentence";
import { RecordList } from "@/components/company/RecordList";
import { VerificationPill } from "@/components/company/VerificationPill";
import { YearTimeline } from "@/components/company/YearTimeline";
import { CompareSlideOver } from "@/components/compare/CompareSlideOver";
import { ExportPanel } from "@/components/company/ExportPanel";
import { InfoSlideOver } from "@/components/shared/InfoSlideOver";
import { money } from "@/components/Charts";
import type { CompanyProfile, RunResult } from "@/lib/types";

/**
 * Takes a profile. Returns the EDGAR link to its 10-K filings, built from the
 * CIK. The financial numbers come from XBRL company facts, which are filed in
 * the 10-K, so this is the primary source for every number in the row.
 */
function tenKUrl(profile: CompanyProfile): string {
  const cik = profile.cik.replace(/^0+/, "") || profile.cik;
  return `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=10-K`;
}

/** Takes a year-to-value series. Returns [year, value] for the latest year. */
function latest(series?: Record<string, number>): [string, number] | null {
  if (!series) return null;
  const years = Object.keys(series).sort();
  if (years.length === 0) return null;
  const year = years[years.length - 1];
  return [year, series[year]];
}

/** Takes a run result. Returns the full company page. */
export function CompanyView({ run }: { run: RunResult }) {
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const records = run.response.records;
  const profile = run.response.profile ?? null;

  const financials = useMemo(() => {
    if (!profile?.ok || !profile.cik) return null;

    const rev = latest(profile.financials?.revenue);
    const inc = latest(profile.financials?.net_income);
    const rd = latest(profile.financials?.research_development);
    // No sourced numbers means no row, never an unsourced value.
    if (!rev && !inc) return null;

    const latestYear = rev?.[0] ?? inc?.[0];
    const margin =
      rev && inc && rev[0] === inc[0] && rev[1] !== 0
        ? `${Math.round((inc[1] / rev[1]) * 100)}%`
        : null;

    return {
      sourceUrl: tenKUrl(profile),
      sourceLabel: `10-K FY${latestYear}`,
      revenue: rev ? money(rev[1]) : null,
      income: inc ? money(inc[1]) : null,
      margin,
      marginYear: rev?.[0],
      rd: rd ? money(rd[1]) : null,
    };
  }, [profile]);

  return (
    <>
      <CompanyHeader
        run={run}
        onCompare={() => setCompareOpen(true)}
        onExport={() => setExportOpen(true)}
      />

      <VerificationPill records={records} />

      <LedeParagraph run={run} />

      {financials && (
        <div className="section-band">
          <div className="metrics">
            {financials.revenue && (
              <FinancialCard
                label="Revenue"
                value={financials.revenue}
                sourceUrl={financials.sourceUrl}
                sourceLabel={financials.sourceLabel}
              />
            )}
            {financials.income && (
              <FinancialCard
                label="Net income"
                value={financials.income}
                sourceUrl={financials.sourceUrl}
                sourceLabel={financials.sourceLabel}
              />
            )}
            {financials.margin && (
              <FinancialCard
                label="Net margin"
                value={financials.margin}
                delta={`FY ${financials.marginYear}`}
                sourceUrl={financials.sourceUrl}
                sourceLabel={financials.sourceLabel}
              />
            )}
            {financials.rd && (
              <FinancialCard
                label="R&D"
                value={financials.rd}
                sourceUrl={financials.sourceUrl}
                sourceLabel={financials.sourceLabel}
              />
            )}
          </div>
          <RDGrowthSentence
            label="R&D spend"
            series={profile?.financials?.research_development}
          />
        </div>
      )}

      <div className="section-band">
        <YearTimeline
          records={records}
          activeYear={activeYear}
          onSelect={setActiveYear}
        />
      </div>

      <div className="section-band">
        <RecordList
          records={records}
          activeYear={activeYear}
          onClearYear={() => setActiveYear(null)}
        />
      </div>

      <CompanyNarrative profile={run.response.profile} />

      <CompanyFooter run={run} onHowItWorks={() => setInfoOpen(true)} />

      <CompareSlideOver
        base={run}
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
      />
      <ExportPanel run={run} open={exportOpen} onClose={() => setExportOpen(false)} />
      <InfoSlideOver open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}
