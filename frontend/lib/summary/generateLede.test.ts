// Unit tests for the lede generator. These lock down the deterministic
// behaviour: a given record set must always produce the same paragraph.

import { describe, expect, it } from "vitest";
import type { PipelineRecord } from "@/lib/types";
import { buildContext, generateLede } from "./generateLede";
import type { RecordSet } from "./types";

/** Takes overrides. Returns a minimal valid record for a test. */
function record(over: Partial<PipelineRecord>): PipelineRecord {
  return {
    source: "openalex",
    record_type: "paper",
    native_id: Math.random().toString(),
    title: "A paper",
    url: "https://openalex.org/W1",
    date: "2023-01-01",
    entity: "Test Co",
    sources: ["https://openalex.org/W1"],
    verified: true,
    extra: {},
    ...over,
  };
}

/** Takes an entity and records. Returns a record set. */
function set(entity: string, records: PipelineRecord[]): RecordSet {
  return { entity, records };
}

describe("generateLede", () => {
  it("handles the empty set", () => {
    const lede = generateLede(set("Empty Co", []));
    expect(lede).toContain("no public records");
    expect(lede.length).toBeGreaterThan(0);
  });

  it("handles a single record", () => {
    const lede = generateLede(
      set("Solo Co", [record({ record_type: "filing", source: "sec_edgar", date: "2024-05-01" })])
    );
    expect(lede).toContain("one public record");
    expect(lede).toContain("SEC filing");
    expect(lede).toContain("2024");
  });

  it("handles a single-source set", () => {
    const records = [
      record({ source: "sec_edgar", record_type: "filing", date: "2022-01-01" }),
      record({ source: "sec_edgar", record_type: "filing", date: "2023-01-01" }),
      record({ source: "sec_edgar", record_type: "filing", date: "2024-01-01" }),
    ];
    const lede = generateLede(set("Filer Co", records));
    expect(lede).toContain("all from SEC EDGAR");
    // A single-source set has no "most active ... followed by" sentence.
    expect(lede).not.toContain("followed by");
  });

  it("describes a multi-source set with dominance", () => {
    const records = [
      ...Array.from({ length: 10 }, () =>
        record({ source: "clinicaltrials", record_type: "trial", date: "2026-01-01" })
      ),
      ...Array.from({ length: 8 }, () =>
        record({ source: "openalex", record_type: "paper", date: "2025-01-01" })
      ),
    ];
    const lede = generateLede(set("Microsoft Corp", records));
    expect(lede).toContain("18 verified records");
    expect(lede).toContain("across two sources");
    // The second sentence is the distinctive fact, not a fixed template.
    // Clinical trials are 10 of 18 (56%), a dominant source.
    expect(lede).toContain("clinical trials");
    // Two sentences at most.
    expect(lede.split(". ").length).toBeLessThanOrEqual(2);
  });

  it("collapses the span when all records fall in one year", () => {
    const records = [
      record({ date: "2020-02-01" }),
      record({ date: "2020-06-01" }),
      record({ date: "2020-09-01" }),
    ];
    const lede = generateLede(set("OneYear Co", records));
    expect(lede).toContain("in 2020");
    expect(lede).not.toContain("spanning");
    // The redundant busiest-year sentence is dropped for a single year.
    expect(lede).not.toContain("busiest year");
  });

  it("reports a wide span greater than twenty years", () => {
    const records = [
      record({ date: "1998-01-01" }),
      record({ date: "2010-01-01" }),
      record({ date: "2026-01-01" }),
    ];
    const context = buildContext(set("OldCo", records));
    expect(context.firstYear).toBe(1998);
    expect(context.lastYear).toBe(2026);
    const lede = generateLede(set("OldCo", records));
    expect(lede).toContain("spanning 1998 to 2026");
  });

  it("still summarizes when no records are recent", () => {
    // Recency drives the "what's new" module, not the lede, but the generator
    // must remain robust when every record is old.
    const records = [
      record({ date: "2001-01-01" }),
      record({ date: "2002-01-01" }),
      record({ date: "2003-01-01" }),
    ];
    const lede = generateLede(set("Vintage Co", records));
    expect(lede).toContain("3 verified records");
  });

  it("is deterministic across repeated calls", () => {
    const records = [
      record({ source: "sec_edgar", record_type: "filing", date: "2024-01-01" }),
      record({ source: "openalex", record_type: "paper", date: "2025-01-01" }),
      record({ source: "nih_reporter", record_type: "grant", date: "2026-01-01" }),
    ];
    const s = set("Repeat Co", records);
    expect(generateLede(s)).toBe(generateLede(s));
  });
});
