// GET /partnership?company=...&institution=... - the partnership lookup.
//
// same contract as /run: with a backend configured via PIPELINE_API_URL the
// request proxies through server-side; without one the bundled sample
// answers. the `x-dossier-mode` header always says which happened, and a
// configured-but-unreachable backend is a 502, never silent sample data.
import { NextResponse } from "next/server";
import { SAMPLE_PARTNERSHIP } from "@/lib/samplePartnership";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const company = url.searchParams.get("company") ?? "";
  const institution = url.searchParams.get("institution") ?? "";
  if (!company.trim() || !institution.trim()) {
    return NextResponse.json(
      { detail: "company and institution are both required" },
      { status: 400 }
    );
  }

  const backend = process.env.PIPELINE_API_URL;
  if (backend) {
    try {
      const upstream = await fetch(
        `${backend}/partnerships?company=${encodeURIComponent(company)}` +
          `&institution=${encodeURIComponent(institution)}`,
        { signal: AbortSignal.timeout(45000) }
      );
      return NextResponse.json(await upstream.json(), {
        status: upstream.status,
        headers: { "x-dossier-mode": "live" },
      });
    } catch (caught) {
      return NextResponse.json(
        { detail: `partnership backend unreachable: ${(caught as Error).message}` },
        { status: 502, headers: { "x-dossier-mode": "live" } }
      );
    }
  }

  return NextResponse.json(SAMPLE_PARTNERSHIP, {
    headers: { "x-dossier-mode": "demo" },
  });
}
