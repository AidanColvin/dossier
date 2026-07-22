// Tests for pickHeadline: names real activity, never corpus statistics.

import { describe, expect, it } from "vitest";
import type { PipelineRecord } from "@/lib/types";
import { pickHeadline } from "./pickHeadline";

/** Takes overrides. Returns a minimal valid record. */
function record(over: Partial<PipelineRecord>): PipelineRecord {
  return {
    source: "openalex",
    record_type: "paper",
    native_id: Math.random().toString(),
    title: "A paper",
    url: "u",
    date: "2024-01-01",
    entity: "x",
    sources: ["u"],
    verified: true,
    extra: {},
    ...over,
  };
}

describe("pickHeadline", () => {
  it("handles the empty set", () => {
    expect(pickHeadline({ entity: "Ghost", records: [] })).toContain("no public records");
  });

  it("names the single record for a one-record set", () => {
    const headline = pickHeadline({
      entity: "Solo",
      records: [record({ title: "Solo's Only Thing" })],
    });
    expect(headline).toContain("Solo's Only Thing");
  });

  it("phrases a trial, a grant, and a paper distinctly", () => {
    const trial = pickHeadline({
      entity: "T",
      records: [
        record({ record_type: "trial", title: "Trial A", date: "2026-01-01" }),
        record({ record_type: "paper", title: "Paper B", date: "2020-01-01" }),
      ],
    });
    expect(trial).toContain("clinical trial is Trial A");

    const grant = pickHeadline({
      entity: "G",
      records: [
        record({ record_type: "grant", title: "Grant A", date: "2026-01-01" }),
        record({ record_type: "paper", title: "Paper B", date: "2020-01-01" }),
      ],
    });
    expect(grant).toContain("NIH grant funds Grant A");

    const paper = pickHeadline({
      entity: "P",
      records: [
        record({ record_type: "paper", title: "Paper A", date: "2026-01-01" }),
        record({ record_type: "grant", title: "Grant B", date: "2020-01-01" }),
      ],
    });
    expect(paper).toContain("published on Paper A");
  });

  it("names the filing's real-world form label, not its raw code alone", () => {
    const headline = pickHeadline({
      entity: "F",
      records: [
        record({ record_type: "filing", title: "x", date: "2024-01-01", extra: { form: "10-K" } }),
        record({ record_type: "filing", title: "y", date: "2020-01-01", extra: { form: "10-K" } }),
      ],
    });
    expect(headline).toContain("annual report");
    expect(headline).toContain("10-K");
  });

  it("drops routine ownership filings from consideration", () => {
    const headline = pickHeadline({
      entity: "F",
      records: [
        record({ record_type: "filing", title: "x", date: "2026-06-01", extra: { form: "4" } }),
        record({ record_type: "filing", title: "y", date: "2025-06-01", extra: { form: "8-K" } }),
      ],
    });
    expect(headline).toContain("current report");
    expect(headline).not.toContain("Form 4");
  });

  it("falls back to the newest record when nothing is substantive", () => {
    const headline = pickHeadline({
      entity: "F",
      records: [
        record({ record_type: "filing", title: "x", date: "2026-06-01", extra: { form: "4" } }),
        record({ record_type: "filing", title: "y", date: "2020-06-01", extra: { form: "5" } }),
      ],
    });
    expect(headline.length).toBeGreaterThan(0);
  });

  it("never mentions a record count or a source count", () => {
    const headline = pickHeadline({
      entity: "Many",
      records: Array.from({ length: 50 }, (_, i) =>
        record({ date: `2020-01-0${(i % 9) + 1}` })
      ),
    });
    expect(headline).not.toMatch(/\d+ records?/);
  });

  it("is deterministic", () => {
    const set = {
      entity: "Repeat",
      records: [record({ date: "2024-01-01" }), record({ date: "2025-01-01" })],
    };
    expect(pickHeadline(set)).toBe(pickHeadline(set));
  });
});
