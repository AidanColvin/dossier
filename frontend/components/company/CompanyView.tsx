"use client";

// Assembles the company page: header, lede, what's new, timeline, record list,
// footer, in that order. Owns the cross section state (the active year that the
// timeline sets and the record list reads) and the panels for export and info.

import { useState } from "react";
import { CompanyFooter } from "@/components/company/CompanyFooter";
import { CompanyHeader } from "@/components/company/CompanyHeader";
import { Financials, Filings } from "@/components/Profile";
import { LedeParagraph } from "@/components/company/LedeParagraph";
import { RecordList } from "@/components/company/RecordList";
import { WhatsNew } from "@/components/company/WhatsNew";
import { YearTimeline } from "@/components/company/YearTimeline";
import { CompareSlideOver } from "@/components/compare/CompareSlideOver";
import { ExportPanel } from "@/components/company/ExportPanel";
import { InfoSlideOver } from "@/components/shared/InfoSlideOver";
import type { RunResult } from "@/lib/types";

/** Takes a run result. Returns the full company page. */
export function CompanyView({ run }: { run: RunResult }) {
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const records = run.response.records;
  const profile = run.response.profile;

  return (
    <>
      <CompanyHeader
        run={run}
        onCompare={() => setCompareOpen(true)}
        onExport={() => setExportOpen(true)}
      />

      <LedeParagraph run={run} />

      <WhatsNew records={records} />

      {profile?.ok && (
        <div className="section-band">
          <Financials profile={profile} />
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

      {profile?.ok && <Filings profile={profile} />}

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
