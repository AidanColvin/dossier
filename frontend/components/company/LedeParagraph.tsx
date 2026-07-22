"use client";

// The generated lede paragraph. This is the most important element on the
// company page: a deterministic two to four sentence summary of the record
// set, computed client side from the same payload the record list uses.

import { useMemo } from "react";
import { generateLede } from "@/lib/summary/generateLede";
import { prettyName } from "@/lib/format";
import type { RunResult } from "@/lib/types";

/** Takes a run result. Returns the summary paragraph with a soft fade in. */
export function LedeParagraph({ run }: { run: RunResult }) {
  const lede = useMemo(
    () =>
      generateLede({
        entity: prettyName(run.response.profile?.name || run.response.entity),
        records: run.response.records,
        profile: run.response.profile,
      }),
    [run]
  );

  return (
    <p className="lede" aria-live="polite">
      {lede}
    </p>
  );
}
