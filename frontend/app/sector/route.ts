// GET /sector?sector=... - the sector scan stream.
//
// with a backend configured via PIPELINE_API_URL the upstream sse body is
// passed through untouched, so progress reaches the browser as it happens.
// with no backend, the bundled sample scan is replayed as the same event
// sequence with small delays. either way the response carries the
// `x-dossier-mode` header so the ui can say which one it is.
//
// unlike /run this handler must never buffer: an sse stream read to the end
// before responding would turn live progress into one late lump.
import { sampleSectorEvents } from "@/lib/sampleSector";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-store",
  Connection: "keep-alive",
};

/**
 * given an event kind and payload
 * return the wire form of one server-sent event
 */
function sseLine(kind: string, payload: unknown): string {
  return `event: ${kind}\ndata: ${JSON.stringify(payload)}\n\n`;
}

/**
 * given nothing
 * return a stream that replays the bundled sample scan with small delays
 */
function demoStream(): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const events = sampleSectorEvents();
  return new ReadableStream({
    async start(controller) {
      for (const event of events) {
        await new Promise((resolve) => setTimeout(resolve, event.delayMs));
        controller.enqueue(encoder.encode(sseLine(event.kind, event.payload)));
      }
      controller.close();
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sector = url.searchParams.get("sector") ?? "";
  if (!sector.trim()) {
    return Response.json({ detail: "sector is required" }, { status: 400 });
  }

  const backend = process.env.PIPELINE_API_URL;
  if (backend) {
    try {
      const upstream = await fetch(
        `${backend}/sector/stream?sector=${encodeURIComponent(sector)}`,
        { signal: request.signal }
      );
      if (!upstream.ok || !upstream.body) {
        return Response.json(
          { detail: `sector backend answered ${upstream.status}` },
          { status: 502, headers: { "x-dossier-mode": "live" } }
        );
      }
      return new Response(upstream.body, {
        headers: { ...SSE_HEADERS, "x-dossier-mode": "live" },
      });
    } catch (caught) {
      // the backend is configured but unreachable. say so rather than quietly
      // replaying sample data that looks like a successful live scan.
      return Response.json(
        { detail: `sector backend unreachable: ${(caught as Error).message}` },
        { status: 502, headers: { "x-dossier-mode": "live" } }
      );
    }
  }

  return new Response(demoStream(), {
    headers: { ...SSE_HEADERS, "x-dossier-mode": "demo" },
  });
}
