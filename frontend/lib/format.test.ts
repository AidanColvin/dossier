// Tests for prettyName, which decides when an all-caps EDGAR name should be
// title-cased and when a genuine brand capitalization must be preserved.

import { describe, expect, it } from "vitest";
import { prettyName } from "./format";

describe("prettyName", () => {
  it("title-cases all-caps legal names", () => {
    expect(prettyName("MICROSOFT CORP")).toBe("Microsoft Corp");
    expect(prettyName("PFIZER INC")).toBe("Pfizer Inc");
    expect(prettyName("ALPHABET INC")).toBe("Alphabet Inc");
  });

  it("preserves genuine brand capitalization", () => {
    expect(prettyName("NVIDIA CORP")).toBe("NVIDIA Corp");
    expect(prettyName("IBM")).toBe("IBM");
  });

  it("leaves already-mixed names as filed", () => {
    expect(prettyName("Apple Inc.")).toBe("Apple Inc");
  });

  it("returns the input unchanged when empty", () => {
    expect(prettyName("")).toBe("");
  });
});
