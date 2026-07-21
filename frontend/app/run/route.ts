// POST /run — if a python backend is configured via PIPELINE_API_URL, proxy
// the request to it for live data; otherwise fall back to the bundled demo so
// the button still works on a standalone deployment.
//
// either way the answer carries an `x-dossier-mode` header (`live` or `demo`)
// so the ui can say which one it is instead of silently presenting sample
// data as a real pipeline run.
import { NextResponse } from "next/server";
import { demoResponse } from "@/lib/demo";

export const dynamic = "force-dynamic";

interface RunBody {
  entity?: string;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RunBody;
  const entity = body.entity ?? "NVIDIA";
  const backend = process.env.PIPELINE_API_URL;

  if (backend) {
    try {
      const upstream = await fetch(`${backend}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return NextResponse.json(await upstream.json(), {
        status: upstream.status,
        headers: { "x-dossier-mode": "live" },
      });
    } catch (caught) {
      // The backend is configured but unreachable. Say so rather than quietly
      // serving sample data that looks like a successful live run.
      return NextResponse.json(
        { detail: `pipeline backend unreachable: ${(caught as Error).message}` },
        { status: 502, headers: { "x-dossier-mode": "live" } }
      );
    }
  }

  return NextResponse.json(demoResponse(entity), {
    headers: { "x-dossier-mode": "demo" },
  });
}
