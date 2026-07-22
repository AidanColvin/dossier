"use client";

// The company page header strip. Shows identity on one line and the page level
// actions (Compare, Export, Share) on the right.

import { useState } from "react";
import { prettyName } from "@/lib/format";
import type { RunResult } from "@/lib/types";

/** Takes a run result. Returns the identity line and action buttons. */
export function CompanyHeader({
  run,
  onCompare,
  onExport,
}: {
  run: RunResult;
  onCompare: () => void;
  onExport: () => void;
}) {
  const profile = run.response.profile;
  const name = prettyName(profile?.name || run.response.entity);
  const location = [profile?.city, profile?.state].filter(Boolean).join(", ");
  const [copied, setCopied] = useState(false);

  /** Copies the current permalink and briefly confirms it. */
  function share() {
    if (typeof window === "undefined") return;
    void navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }

  return (
    <header className="company-head">
      <div className="company-head__id">
        <h1>{name}</h1>
        {profile?.ticker && (
          <span className="fact-banner__ticker">{profile.ticker}</span>
        )}
        <div className="company-head__meta">
          {[profile?.exchange, profile?.industry, location]
            .filter(Boolean)
            .map((part, index) => (
              <span key={part}>
                {index > 0 && <span className="record__dot">·</span>} {part}
              </span>
            ))}
        </div>
      </div>

      <div className="company-head__actions">
        <button type="button" className="btn btn--sm" onClick={onCompare}>
          Compare
        </button>
        <button type="button" className="btn btn--sm" onClick={onExport}>
          Export
        </button>
        <button type="button" className="btn btn--sm" onClick={share}>
          {copied ? "Copied" : "Share"}
        </button>
      </div>
    </header>
  );
}
