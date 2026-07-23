// tests for the rendered-link allowlist.
import { describe, expect, it } from "vitest";
import { safeUrl } from "./safeUrl";

describe("safeUrl", () => {
  it("passes plain http and https links through", () => {
    expect(safeUrl("https://www.sec.gov/x")).toBe("https://www.sec.gov/x");
    expect(safeUrl("http://openalex.org/W1")).toBe("http://openalex.org/W1");
  });

  it("drops every non-http scheme", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("data:text/html,x")).toBe("");
    expect(safeUrl("vbscript:x")).toBe("");
    expect(safeUrl("//protocol-relative.example")).toBe("");
  });

  it("drops control-character smuggling", () => {
    expect(safeUrl("java\u0000script:alert(1)")).toBe("");
    expect(safeUrl("https://ok.example/\u0001x")).toBe("");
  });

  it("handles empty and whitespace input", () => {
    expect(safeUrl("")).toBe("");
    expect(safeUrl("   ")).toBe("");
  });
});
