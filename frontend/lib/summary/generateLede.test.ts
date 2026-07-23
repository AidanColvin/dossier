// Unit tests for the lede generator. The lede names what the company is
// actually doing (its most recent substantive activity), not the shape of the
// record set. These tests lock down that a given record set always produces
// the same, substance-first paragraph.

import { describe, expect, it } from "vitest";
import type { PipelineRecord } from "@/lib/types";
import { generateLede } from "./generateLede";
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
  });

  it("handles a single record by naming it, not counting it", () => {
    const lede = generateLede(
      set("Solo Co", [
        record({ record_type: "filing", source: "sec_edgar", title: "10-K filed 2024-05-01" }),
      ])
    );
    expect(lede).toContain("only public record");
    expect(lede).toContain("10-K filed 2024-05-01");
    // No record-count or source-count framing.
    expect(lede).not.toMatch(/\d+ (verified )?records?/);
  });

  it("never states a record count, a source count, or a date span", () => {
    const records = [
      record({ source: "clinicaltrials", record_type: "trial", title: "A Trial", date: "2026-01-01" }),
      record({ source: "openalex", record_type: "paper", title: "A Paper", date: "2020-01-01" }),
      record({ source: "sec_edgar", record_type: "filing", title: "x", date: "1999-01-01",
        extra: { form: "10-K" } }),
    ];
    const lede = generateLede(set("Any Co", records));
    expect(lede).not.toMatch(/\d+ (verified )?records?\b/);
    expect(lede).not.toMatch(/across (two|three|four) sources/);
    expect(lede).not.toMatch(/spanning \d{4} to \d{4}/);
  });

  it("names the most recent clinical trial by title", () => {
    const records = [
      record({ source: "clinicaltrials", record_type: "trial", title: "Apple Hearing Study",
        date: "2026-03-01" }),
      record({ source: "openalex", record_type: "paper", title: "Old Paper", date: "2019-01-01" }),
    ];
    const lede = generateLede(set("Apple", records));
    expect(lede).toContain("Its most recent clinical trial is Apple Hearing Study");
  });

  it("adds a second sentence from a different record type when one is recent", () => {
    const records = [
      record({ source: "clinicaltrials", record_type: "trial", title: "Apple Hearing Study",
        date: "2026-03-01" }),
      record({ source: "openalex", record_type: "paper", title: "Search Relevance Paper",
        date: "2026-02-01" }),
    ];
    const lede = generateLede(set("Apple", records));
    expect(lede).toContain("Apple Hearing Study");
    expect(lede).toContain("Search Relevance Paper");
    // Two sentences, not a list of everything.
    expect(lede.split(". ").length).toBeLessThanOrEqual(2);
  });

  it("does not add a second sentence of the same type as the first", () => {
    const records = [
      record({ source: "openalex", record_type: "paper", title: "Newest Paper", date: "2026-03-01" }),
      record({ source: "openalex", record_type: "paper", title: "Older Paper", date: "2026-01-01" }),
    ];
    const lede = generateLede(set("Research Co", records));
    expect(lede).toContain("Newest Paper");
    expect(lede).not.toContain("Older Paper");
  });

  it("excludes routine ownership filings from the substantive pool", () => {
    const records = [
      record({ source: "sec_edgar", record_type: "filing", title: "Form 4 filed 2026-07-01",
        date: "2026-07-01", extra: { form: "4" } }),
      record({ source: "sec_edgar", record_type: "filing", title: "10-K filed 2025-11-01",
        date: "2025-11-01", extra: { form: "10-K" } }),
    ];
    const lede = generateLede(set("Filer Co", records));
    // The 10-K is older but substantive; the Form 4 is newer but routine.
    expect(lede).toContain("annual report");
    expect(lede).not.toContain("Form 4");
  });

  it("falls back to the most recent record of any kind when nothing is substantive", () => {
    const records = [
      record({ source: "sec_edgar", record_type: "filing", title: "x", date: "2026-01-01",
        extra: { form: "4" } }),
      record({ source: "sec_edgar", record_type: "filing", title: "y", date: "2020-01-01",
        extra: { form: "3" } }),
    ];
    const lede = generateLede(set("Ownership Co", records));
    // Neither form is substantive, so the newest one is still named, not
    // silently dropped into an empty lede.
    expect(lede.length).toBeGreaterThan(0);
    expect(lede).toMatch(/2026/);
  });

  it("truncates a very long title at a word boundary", () => {
    const longTitle =
      "Adaptive Model Compression for Ultra Low Power Transformer Inference on Embedded Devices in Constrained Manufacturing Environments With Real Time Telemetry";
    const records = [
      record({ record_type: "paper", title: longTitle, date: "2026-01-01" }),
    ];
    const lede = generateLede(set("Long Co", records));
    expect(lede.length).toBeLessThan(longTitle.length + 60);
    expect(lede).toContain("…");
  });

  it("is deterministic across repeated calls", () => {
    const records = [
      record({ source: "sec_edgar", record_type: "filing", date: "2024-01-01", extra: { form: "8-K" } }),
      record({ source: "openalex", record_type: "paper", date: "2025-01-01" }),
    ];
    const s = set("Repeat Co", records);
    expect(generateLede(s)).toBe(generateLede(s));
  });

  // With SEC financials on file, the lede opens with money: how big, whether
  // growing, whether profitable. That is what a reader came for; activity
  // trivia moves to the end of the paragraph.

  const profile = {
    name: "NVIDIA CORP", cik: "0001045810", ticker: "NVDA", exchange: "Nasdaq",
    industry: "Semiconductors & Related Devices", city: "Santa Clara", state: "CA",
    website: "", fiscal_year_end: "", filings: [], ok: true,
    financials: {
      revenue: { "2024": 60922000000, "2025": 130497000000 },
      net_income: { "2024": 29760000000, "2025": 72880000000 },
    },
  };

  it("opens with revenue, growth, and net margin when financials exist", () => {
    const records = [record({ record_type: "paper", title: "Some paper", date: "2026-01-01" })];
    const lede = generateLede({ entity: "NVIDIA", records, profile });
    expect(lede.startsWith("NVIDIA generated $130.5B in revenue in FY2025")).toBe(true);
    expect(lede).toContain("up 114% year over year");
    expect(lede).toContain("net income of $72.9B");
    expect(lede).toContain("55.8% net margin");
    // Identity follows the money.
    expect(lede).toContain("NVDA on Nasdaq");
    // Activity closes the paragraph rather than leading it.
    expect(lede.indexOf("$130.5B")).toBeLessThan(lede.indexOf("Some paper"));
  });

  it("states a net loss plainly instead of a negative margin", () => {
    const lossProfile = {
      ...profile,
      financials: {
        revenue: { "2024": 53101000000 },
        net_income: { "2024": -18756000000 },
      },
    };
    const lede = generateLede({ entity: "Intel", records: [], profile: lossProfile });
    expect(lede).toContain("net loss of $18.8B");
    expect(lede).not.toContain("-");
  });

  it("skips the growth clause when only one year is on file", () => {
    const oneYear = {
      ...profile,
      financials: { revenue: { "2025": 1000000000 }, net_income: {} },
    };
    const lede = generateLede({ entity: "Solo Co", records: [], profile: oneYear });
    expect(lede).toContain("generated $1.0B in revenue in FY2025");
    expect(lede).not.toContain("year over year");
  });

  it("falls back to the activity headline without financials", () => {
    const records = [record({ record_type: "paper", title: "Only paper", date: "2026-01-01" })];
    const bare = { ...profile, financials: {} };
    const lede = generateLede({ entity: "Private Co", records, profile: bare });
    expect(lede.startsWith("Private Co's only public record is")).toBe(true);
  });
});
