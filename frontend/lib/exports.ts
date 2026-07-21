// client-side export of a run to csv, json or markdown. everything is built
// in the browser from the already-fetched response — no extra request, no
// export dependency, and nothing leaves the page except via the user's own
// download.
import { sourceLabel, typeLabel } from "./format";
import type { PipelineRecord, RunResponse } from "./types";

export type ExportFormat = "csv" | "json" | "markdown";

const CSV_COLUMNS = [
  "entity",
  "source",
  "record_type",
  "date",
  "title",
  "url",
  "native_id",
  "verified",
  "provenance_urls",
] as const;

/**
 * given one cell's raw text
 * return it quoted for csv — doubling embedded quotes, and always quoting so
 * commas, newlines and leading zeros survive a trip through excel
 */
function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * given the records of a run
 * return an rfc-4180 csv document with a header row
 */
export function toCsv(records: PipelineRecord[]): string {
  const rows = [CSV_COLUMNS.join(",")];
  for (const record of records) {
    rows.push(
      [
        csvCell(record.entity),
        csvCell(record.source),
        csvCell(record.record_type),
        csvCell(record.date),
        csvCell(record.title),
        csvCell(record.url),
        csvCell(record.native_id),
        csvCell(record.verified),
        csvCell((record.sources ?? []).join(" | ")),
      ].join(",")
    );
  }
  return rows.join("\r\n");
}

/**
 * given a full run response
 * return a markdown briefing: a header, the per-source status table, and the
 * records grouped under a heading per record type
 */
export function toMarkdown(response: RunResponse): string {
  const lines: string[] = [
    `# ${response.entity} — Dossier`,
    "",
    `${response.count} record${response.count === 1 ? "" : "s"} across ${
      response.sources.length
    } sources.`,
    "",
    "## Source status",
    "",
    "| Source | Status | Records |",
    "| --- | --- | --- |",
  ];

  for (const source of response.sources) {
    const status = source.ok ? "ok" : `failed — ${source.error || "unknown"}`;
    lines.push(`| ${sourceLabel(source.source)} | ${status} | ${source.count} |`);
  }

  const groups = new Map<string, PipelineRecord[]>();
  for (const record of response.records) {
    const list = groups.get(record.record_type) ?? [];
    list.push(record);
    groups.set(record.record_type, list);
  }

  for (const [type, records] of groups) {
    lines.push("", `## ${typeLabel(type)}`, "");
    for (const record of records) {
      const date = record.date ? ` (${record.date})` : "";
      const mark = record.verified ? "" : " — unverified";
      lines.push(`- [${record.title}](${record.url})${date}${mark}`);
    }
  }

  return lines.join("\n");
}

/**
 * given a run response and a target format
 * return the file body and the filename to save it under
 */
export function buildExport(
  response: RunResponse,
  format: ExportFormat
): { body: string; filename: string; mime: string } {
  const slug =
    response.entity
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "dossier";

  if (format === "csv") {
    return {
      body: toCsv(response.records),
      filename: `${slug}-dossier.csv`,
      mime: "text/csv;charset=utf-8",
    };
  }
  if (format === "markdown") {
    return {
      body: toMarkdown(response),
      filename: `${slug}-dossier.md`,
      mime: "text/markdown;charset=utf-8",
    };
  }
  return {
    body: JSON.stringify(response, null, 2),
    filename: `${slug}-dossier.json`,
    mime: "application/json",
  };
}

/**
 * given a file body, a filename and a mime type
 * trigger a browser download, then release the object url
 */
export function download(body: string, filename: string, mime: string): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
