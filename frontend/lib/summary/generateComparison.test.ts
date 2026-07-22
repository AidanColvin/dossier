// Unit tests for the comparison generator, locking down the deterministic
// finding sentence across the required cases.

import { describe, expect, it } from "vitest";
import type { PipelineRecord } from "@/lib/types";
import { generateComparison } from "./generateComparison";
import type { RecordSet } from "./types";

/** Takes overrides. Returns a minimal valid record. */
function record(over: Partial<PipelineRecord>): PipelineRecord {
  return {
    source: "openalex",
    record_type: "paper",
    native_id: Math.random().toString(),
    title: "t",
    url: "u",
    date: "2024-01-01",
    entity: "x",
    sources: ["u"],
    verified: true,
    extra: {},
    ...over,
  };
}

/** Takes a source, a count, and a date. Returns that many records. */
function many(source: string, count: number, date: string): PipelineRecord[] {
  return Array.from({ length: count }, () => record({ source, date }));
}

/** Takes an entity and records. Returns a record set. */
function set(entity: string, records: PipelineRecord[]): RecordSet {
  return { entity, records };
}

describe("generateComparison", () => {
  it("states parity when counts are equal", () => {
    const finding = generateComparison(
      set("A Co", many("sec_edgar", 5, "2024-01-01")),
      set("B Co", many("openalex", 5, "2024-01-01"))
    );
    expect(finding).toContain("each have 5 records");
  });

  it("names the dominant company", () => {
    const finding = generateComparison(
      set("Big Co", many("sec_edgar", 30, "2024-01-01")),
      set("Small Co", many("sec_edgar", 10, "2024-01-01"))
    );
    expect(finding).toContain("Big Co has 30 records to Small Co's 10");
    // 30 vs 10 on the same source is 200% more.
    expect(finding).toContain("200% more records on SEC EDGAR");
  });

  it("handles no overlap in the source mix", () => {
    const finding = generateComparison(
      set("Trials Co", many("clinicaltrials", 8, "2023-01-01")),
      set("Papers Co", many("openalex", 8, "2025-01-01"))
    );
    // Equal totals, but the widest per-source gap is 8 to 0.
    expect(finding).toContain("each have 8 records");
    expect(finding).toMatch(/has 8 records on .*; the other has none/);
    // Different peak years.
    expect(finding).toContain("Trials Co peaks in 2023, Papers Co in 2025");
  });

  it("handles one company empty", () => {
    const finding = generateComparison(
      set("Has Co", many("sec_edgar", 4, "2024-01-01")),
      set("Empty Co", [])
    );
    expect(finding).toContain("Has Co has 4 public records; Empty Co has none");
  });

  it("reports a shared busiest year", () => {
    const finding = generateComparison(
      set("A Co", many("sec_edgar", 6, "2026-01-01")),
      set("B Co", many("openalex", 4, "2026-01-01"))
    );
    expect(finding).toContain("Both companies are most active in 2026");
  });

  it("is deterministic", () => {
    const a = set("A Co", many("sec_edgar", 6, "2026-01-01"));
    const b = set("B Co", many("openalex", 4, "2025-01-01"));
    expect(generateComparison(a, b)).toBe(generateComparison(a, b));
  });
});
