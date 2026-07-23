// builds a RunResponse from the bundled sample dataset, so the deployed site
// works fully online with no python backend. when a backend is configured the
// route handlers proxy to it instead (see app/run/route.ts).
import { demoProfile } from "./demoProfiles";
import sample from "./sample_data.json";
import type { PipelineRecord, RunResponse, SourceStatus } from "./types";

interface Entry {
  sources: SourceStatus[];
  records: PipelineRecord[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function demoResponse(entity: string): RunResponse {
  const dataset = sample as unknown as Record<string, Entry>;
  const slug = dataset[slugify(entity)] ? slugify(entity) : Object.keys(dataset)[0];
  const entry = dataset[slug];
  const label = entry.records[0]?.entity ?? entity;
  const profile = demoProfile(slug);
  return {
    entity: label,
    count: entry.records.length,
    records: entry.records,
    sources: entry.sources,
    ...(profile
      ? { profile, resolved: true, cik: profile.cik, ticker: profile.ticker }
      : {}),
  };
}
