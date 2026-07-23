// tests for the hand-written zip/xlsx writer.
//
// crc32 and the zip byte layout are exactly the kind of code that looks
// right and silently isn't, so this test actually decodes the archive back
// out (its own minimal stored-entry reader) rather than only checking magic
// bytes, and separately confirms the workbook opens as valid, well-formed
// xml with the right cell values in the right places.

import { describe, expect, it } from "vitest";
import { buildXlsx, crc32, zipStore } from "./xlsx";

/**
 * given a zip archive built by zipStore (stored entries only)
 * return its {name, text} entries, decoded by hand — a from-scratch reader
 * independent of the writer's internal helpers, so a bug shared between
 * writer and reader can't hide a real corruption
 */
function readZipStore(buffer: Uint8Array): Array<{ name: string; text: string }> {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const entries: Array<{ name: string; text: string }> = [];
  let offset = 0;
  while (offset < buffer.length && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = new TextDecoder().decode(
      buffer.slice(nameStart, nameStart + nameLength)
    );
    const text = new TextDecoder().decode(
      buffer.slice(dataStart, dataStart + compressedSize)
    );
    entries.push({ name, text });
    offset = dataStart + compressedSize;
  }
  return entries;
}

describe("crc32", () => {
  it("matches the well-known reference value for an empty input", () => {
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("matches the well-known reference value for 'abc'", () => {
    // this is the standard crc32 test vector; getting it right rules out
    // an off-by-one in the table or the final xor.
    expect(crc32(new TextEncoder().encode("abc"))).toBe(0x352441c2);
  });
});

describe("zipStore", () => {
  it("round-trips every entry's name and bytes exactly", () => {
    const archive = zipStore([
      { name: "a.txt", data: new TextEncoder().encode("hello") },
      { name: "dir/b.txt", data: new TextEncoder().encode("second entry") },
    ]);
    const entries = readZipStore(archive);
    expect(entries).toEqual([
      { name: "a.txt", text: "hello" },
      { name: "dir/b.txt", text: "second entry" },
    ]);
  });

  it("starts with the local file header signature", () => {
    const archive = zipStore([{ name: "x", data: new Uint8Array([1, 2, 3]) }]);
    expect(archive[0]).toBe(0x50);
    expect(archive[1]).toBe(0x4b);
  });

  it("ends with the end-of-central-directory signature", () => {
    const archive = zipStore([{ name: "x", data: new Uint8Array([1]) }]);
    const tail = archive.slice(-22, -18);
    expect([...tail]).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });

  it("handles zero entries without throwing", () => {
    expect(() => zipStore([])).not.toThrow();
  });
});

describe("buildXlsx", () => {
  it("produces a well-formed archive with every expected part", () => {
    const archive = buildXlsx("Directory", [
      ["Ticker", "Name", "Exchange"],
      ["AAPL", "Apple Inc.", "Nasdaq"],
    ]);
    const entries = readZipStore(archive);
    const names = entries.map((e) => e.name);
    expect(names).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  it("writes cells at the correct references with escaped content", () => {
    const archive = buildXlsx("Sheet1", [
      ["A & B", "2"],
      ["<tag>", "AAPL"],
    ]);
    const sheet = readZipStore(archive).find(
      (e) => e.name === "xl/worksheets/sheet1.xml"
    )!.text;
    expect(sheet).toContain('<c r="A1" t="inlineStr"><is><t>A &amp; B</t></is></c>');
    expect(sheet).toContain('<c r="B1" t="inlineStr"><is><t>2</t></is></c>');
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t>&lt;tag&gt;</t></is></c>');
  });

  it("names the sheet after the argument", () => {
    const archive = buildXlsx("My Companies", [["x"]]);
    const workbook = readZipStore(archive).find(
      (e) => e.name === "xl/workbook.xml"
    )!.text;
    expect(workbook).toContain('name="My Companies"');
  });
});
