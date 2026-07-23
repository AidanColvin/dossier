// client-side consumer for the /sector server-sent event stream.
//
// EventSource cannot read response headers, and the ui needs the
// `x-dossier-mode` header to say whether a scan is live or the bundled
// sample. so the stream is read with fetch and parsed by hand; sse framing
// is just double-newline-separated blocks of `event:` and `data:` lines.

import type { RunMode } from "./types";
import type { SectorEventKind } from "./sectorTypes";

export type SectorEventHandler = (kind: SectorEventKind, payload: unknown) => void;

/**
 * given a raw sse block
 * return its (kind, payload) pair, or null when the block has no event line
 */
function parseBlock(block: string): { kind: SectorEventKind; payload: unknown } | null {
  let kind = "";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event: ")) kind = line.slice("event: ".length).trim();
    else if (line.startsWith("data: ")) data = line.slice("data: ".length);
  }
  if (!kind) return null;
  let payload: unknown = {};
  try {
    payload = data ? JSON.parse(data) : {};
  } catch {
    payload = {};
  }
  return { kind: kind as SectorEventKind, payload };
}

/**
 * given a sector query and an event handler
 * stream the scan, calling the handler for each event as it arrives, and
 * return the run mode once the stream ends
 * throw when the route answers with an error status
 */
export async function streamSectorScan(
  sector: string,
  onEvent: SectorEventHandler,
  signal?: AbortSignal
): Promise<RunMode> {
  const response = await fetch(`/sector?sector=${encodeURIComponent(sector)}`, {
    signal,
  });
  if (!response.ok || !response.body) {
    const detail = await response
      .json()
      .then((body: { detail?: string }) => body.detail)
      .catch(() => undefined);
    throw new Error(detail ?? `sector scan failed (${response.status})`);
  }
  const mode: RunMode =
    response.headers.get("x-dossier-mode") === "live" ? "live" : "demo";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split = buffer.indexOf("\n\n");
    while (split !== -1) {
      const block = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const event = parseBlock(block);
      if (event) onEvent(event.kind, event.payload);
      split = buffer.indexOf("\n\n");
    }
  }
  return mode;
}
