// POST /run — if a python backend is configured via PIPELINE_API_URL, proxy
// the request to it for live data; otherwise fall back to the bundled demo so
// the button still works on a standalone deployment.
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
    const response = await fetch(`${backend}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await response.json(), { status: response.status });
  }

  return NextResponse.json(demoResponse(entity));
}
