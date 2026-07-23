// GET /companies?search=&exchange=&sort=&order=&limit=&offset= - the
// directory data route.
//
// with a backend configured via PIPELINE_API_URL the query proxies to its
// /directory endpoint (the full sec-listed universe). without one, the same
// query semantics run here over the bundled sample so the table behaves
// identically in demo mode. the `x-dossier-mode` header says which happened.
import { NextResponse } from "next/server";
import { SAMPLE_DIRECTORY, type DirectoryCompany } from "@/lib/sampleDirectory";

export const dynamic = "force-dynamic";

const SORT_FIELDS = new Set(["name", "ticker", "exchange", "cik"]);

/**
 * given the sample directory and the query params
 * return {total, exchanges, companies}, mirroring the backend's semantics
 */
function querySample(params: URLSearchParams): {
  total: number;
  exchanges: string[];
  companies: DirectoryCompany[];
} {
  const search = (params.get("search") ?? "").trim().toLowerCase();
  const exchange = (params.get("exchange") ?? "").trim().toLowerCase();
  const sortParam = params.get("sort") ?? "name";
  const sort = (SORT_FIELDS.has(sortParam) ? sortParam : "name") as keyof DirectoryCompany;
  const order = params.get("order") === "desc" ? -1 : 1;
  const limit = Math.min(Number(params.get("limit") ?? 50) || 50, 200);
  const offset = Math.max(Number(params.get("offset") ?? 0) || 0, 0);

  const matches = SAMPLE_DIRECTORY.filter(
    (company) =>
      (!search ||
        company.name.toLowerCase().includes(search) ||
        company.ticker.toLowerCase().includes(search)) &&
      (!exchange || company.exchange.toLowerCase() === exchange)
  ).sort((a, b) => order * a[sort].toLowerCase().localeCompare(b[sort].toLowerCase()));

  return {
    total: matches.length,
    exchanges: [...new Set(SAMPLE_DIRECTORY.map((c) => c.exchange))].sort(),
    companies: matches.slice(offset, offset + limit),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const backend = process.env.PIPELINE_API_URL;

  if (backend) {
    try {
      const upstream = await fetch(`${backend}/directory?${url.searchParams}`, {
        signal: AbortSignal.timeout(25000),
      });
      return NextResponse.json(await upstream.json(), {
        status: upstream.status,
        headers: { "x-dossier-mode": "live" },
      });
    } catch (caught) {
      return NextResponse.json(
        { detail: `directory backend unreachable: ${(caught as Error).message}` },
        { status: 502, headers: { "x-dossier-mode": "live" } }
      );
    }
  }

  return NextResponse.json(querySample(url.searchParams), {
    headers: { "x-dossier-mode": "demo" },
  });
}
