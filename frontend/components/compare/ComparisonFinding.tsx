"use client";

// The generated finding that sits atop a comparison. Deterministic, computed
// from both record sets client side.

import { useMemo } from "react";
import { generateComparison } from "@/lib/summary/generateComparison";
import { prettyName } from "@/lib/format";
import type { RunResult } from "@/lib/types";

/** Takes two runs. Returns the contrast sentence. */
export function ComparisonFinding({
  left,
  right,
}: {
  left: RunResult;
  right: RunResult;
}) {
  const finding = useMemo(
    () =>
      generateComparison(
        {
          entity: prettyName(left.response.profile?.name || left.response.entity),
          records: left.response.records,
        },
        {
          entity: prettyName(right.response.profile?.name || right.response.entity),
          records: right.response.records,
        }
      ),
    [left, right]
  );

  return <p className="lede">{finding}</p>;
}
