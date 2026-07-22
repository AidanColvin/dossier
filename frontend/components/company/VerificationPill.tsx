"use client";

// A small pill under the company header that teaches what "verified" means
// before the reader reaches the records. Lists the match methods actually
// present in the set, so the claim is specific to this company.

import { useMemo } from "react";
import type { PipelineRecord } from "@/lib/types";

const METHOD_WORD: Record<string, string> = {
  cik_match: "CIK",
  sponsor_match: "sponsor",
  awardee_match: "awardee",
  author_affiliation: "author affiliation",
};

/** Takes records. Returns the verification pill, or nothing when empty. */
export function VerificationPill({ records }: { records: PipelineRecord[] }) {
  const { count, methods } = useMemo(() => {
    const present = new Set<string>();
    let verified = 0;
    for (const record of records) {
      const method = record.verification?.method;
      if (record.verification?.strict) verified += 1;
      if (method && METHOD_WORD[method]) present.add(METHOD_WORD[method]);
    }
    return { count: verified, methods: [...present] };
  }, [records]);

  if (records.length === 0) return null;

  const list =
    methods.length > 0
      ? methods.join(", ").replace(/, ([^,]*)$/, ", or $1")
      : "primary source";

  return (
    <div className="verify-pill">
      <span className="verify-pill__dot" aria-hidden />
      {count} {count === 1 ? "record" : "records"} verified by {list}
    </div>
  );
}
