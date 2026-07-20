// GET /demo?entity=... — serves bundled demo data so the ui works with no
// network. mirrors the fastapi /demo endpoint so the same client code works
// whether it talks to this app or to the python backend.
import { NextResponse } from "next/server";
import { demoResponse } from "@/lib/demo";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const entity = new URL(request.url).searchParams.get("entity") ?? "NVIDIA";
  return NextResponse.json(demoResponse(entity));
}
