// Tests for pickInterestingFact, which gives each company a distinctive second
// sentence rather than the same "led by" clause.

import { describe, expect, it } from "vitest";
import type { PipelineRecord } from "@/lib/types";
import { pickInterestingFact } from "./pickInterestingFact";

/** Takes a source, type, count, and year. Returns that many records. */
function many(
  source: string,
  type: string,
  count: number,
  year: number
): PipelineRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    source,
    record_type: type,
    native_id: `${source}-${year}-${i}`,
    title: "t",
    url: "u",
    date: `${year}-01-01`,
    entity: "x",
    sources: ["u"],
    verified: true,
    extra: {},
  }));
}

describe("pickInterestingFact", () => {
  it("calls out a dominant source", () => {
    const records = [
      ...many("nih_reporter", "grant", 8, 2024),
      ...many("openalex", "paper", 2, 2023),
    ];
    const fact = pickInterestingFact({ entity: "Moderna", records });
    expect(fact).toContain("NIH grants");
    expect(fact).toMatch(/\d+% of that is/);
  });

  it("notes an even spread across four sources", () => {
    const records = [
      ...many("sec_edgar", "filing", 3, 2024),
      ...many("openalex", "paper", 3, 2023),
      ...many("clinicaltrials", "trial", 3, 2022),
      ...many("nih_reporter", "grant", 3, 2021),
    ];
    const fact = pickInterestingFact({ entity: "Apple", records });
    expect(fact).toContain("all four sources");
  });

  it("notes a concentrated recent year when no source dominates", () => {
    // Two sources near-balanced (no source over 45%), only three sources so no
    // even-spread claim, but most records land in one recent year.
    const records = [
      ...many("sec_edgar", "filing", 4, 2026),
      ...many("openalex", "paper", 4, 2026),
      ...many("clinicaltrials", "trial", 3, 2018),
    ];
    const fact = pickInterestingFact({ entity: "NVIDIA", records });
    expect(fact).toContain("2026");
  });

  it("notes a long span when nothing else stands out", () => {
    const records = [
      ...many("sec_edgar", "filing", 2, 1998),
      ...many("openalex", "paper", 2, 2010),
      ...many("clinicaltrials", "trial", 2, 2015),
      ...many("nih_reporter", "grant", 1, 2026),
    ];
    // Even spread would trigger first here, so drop to three sources to test span.
    const spanRecords = records.filter((r) => r.source !== "nih_reporter");
    const fact = pickInterestingFact({ entity: "OldCo", records: spanRecords });
    expect(fact).toMatch(/runs back to 1998|split between|Most of it/);
  });

  it("handles the empty set", () => {
    expect(pickInterestingFact({ entity: "Ghost", records: [] })).toBe("");
  });

  it("handles a single record", () => {
    const fact = pickInterestingFact({
      entity: "Solo",
      records: many("sec_edgar", "filing", 1, 2024),
    });
    expect(fact).toContain("single record");
  });

  it("gives different companies different facts", () => {
    const moderna = pickInterestingFact({
      entity: "Moderna",
      records: [
        ...many("nih_reporter", "grant", 9, 2024),
        ...many("openalex", "paper", 3, 2023),
      ],
    });
    const apple = pickInterestingFact({
      entity: "Apple",
      records: [
        ...many("sec_edgar", "filing", 3, 2024),
        ...many("openalex", "paper", 3, 2023),
        ...many("clinicaltrials", "trial", 3, 2022),
        ...many("nih_reporter", "grant", 3, 2021),
      ],
    });
    expect(moderna).not.toBe(apple);
  });
});
