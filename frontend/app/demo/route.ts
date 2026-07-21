// GET /demo?entity=... — the dossier shown on first load.
//
// When a pipeline backend is configured, this runs the *real* pipeline for the
// entity, so a connected deployment lands on live data rather than greeting
// visitors with sample records. With no backend it serves the bundled sample.
// Either way the answer carries x-dossier-mode, so the UI can say which it is.
import { NextResponse } from "next/server";
import { demoResponse } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const entity = new URL(request.url).searchParams.get("entity") ?? "NVIDIA";
  const backend = process.env.PIPELINE_API_URL;

  if (backend) {
    try {
      const upstream = await fetch(`${backend}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, max_results: 10 }),
        // The first paint must not hang on a cold backend; fall through to the
        // bundled sample if the pipeline is slow to wake.
        signal: AbortSignal.timeout(25000),
      });
      if (upstream.ok) {
        return NextResponse.json(await upstream.json(), {
          headers: { "x-dossier-mode": "live" },
        });
      }
    } catch {
      // Fall through to the sample rather than erroring on the first load.
    }
  }

  return NextResponse.json(demoResponse(entity), {
    headers: { "x-dossier-mode": "demo" },
  });
}
