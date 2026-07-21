// Pipeline — what the system actually does, stage by stage, and whether this
// particular deployment is wired to a live backend.
//
// A server component on purpose: it reads PIPELINE_API_URL at request time and
// probes /health, so the page reports the real connection state of the running
// deployment rather than guessing from the client.

import type { Metadata } from "next";
import { SOURCES } from "@/lib/sources";

export const metadata: Metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

const REPO_URL = "https://github.com/AidanColvin/dossier";

// takes: nothing
// does: draws the GitHub mark inline, sized to sit on the text baseline next
//       to the link label
// returns: the icon element
function GitHubMark() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      style={{ verticalAlign: "-2px", marginRight: 7 }}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

const STAGES = [
  {
    name: "Extract",
    module: "core/extract.py",
    detail:
      "Each connector queries its own public endpoint over a shared HTTP client with retries, timeouts and a rate limiter. A connector that fails is recorded as a failed source rather than aborting the run — a dead API degrades the dossier, it does not kill it.",
  },
  {
    name: "Transform",
    module: "core/transform.py",
    detail:
      "Every upstream payload is mapped into one record shape: source, record type, native identifier, title, URL, date, entity, provenance URLs. Titles are normalized for matching, dates coerced to ISO-8601.",
  },
  {
    name: "Deduplicate",
    module: "transform/dedup.py",
    detail:
      "Records matching on normalized title and identifier are merged and their provenance lists unioned. This is what lets a record end up attested by more URLs than the single connector that surfaced it.",
  },
  {
    name: "Validate",
    module: "transform/validate.py",
    detail:
      "A record is marked verified when its provenance list holds at least min_sources distinct URLs. Records below the threshold are kept and labelled, never silently dropped.",
  },
  {
    name: "Load",
    module: "load/",
    detail:
      "The result set is emitted as JSON, CSV or SQLite, or returned over HTTP by the FastAPI service that this frontend calls.",
  },
];

// takes: nothing
// does: probes the configured backend's /health endpoint with a short timeout
// returns: the connection state shown in the banner
async function probeBackend(): Promise<{
  configured: boolean;
  reachable: boolean;
  detail: string;
}> {
  const backend = process.env.PIPELINE_API_URL;
  if (!backend) {
    return {
      configured: false,
      reachable: false,
      detail: "PIPELINE_API_URL is not set.",
    };
  }
  try {
    // Keep the probe short: this runs on every page view, and a hung backend
    // must not hold the response open.
    const response = await fetch(`${backend}/health`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        configured: true,
        reachable: false,
        detail: `${backend} answered ${response.status}.`,
      };
    }
    const body = (await response.json()) as { version?: string };
    return {
      configured: true,
      reachable: true,
      detail: `${backend} · pipeline v${body.version ?? "unknown"}`,
    };
  } catch (caught) {
    return {
      configured: true,
      reachable: false,
      detail: `${backend} did not respond: ${(caught as Error).message}`,
    };
  }
}

export default async function PipelinePage() {
  const backend = await probeBackend();

  return (
    <main className="page">
      <div className="page-head">
        <h1>Pipeline</h1>
        <p>
          Dossier is a modular ETL pipeline with an HTTP front door. The
          connectors know nothing about each other; the core knows nothing about
          any specific API. Adding a fifth source is a one-line change to the
          registry.
        </p>
        <p style={{ marginTop: 16 }}>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            <GitHubMark /> View the source on GitHub
          </a>
        </p>
      </div>

      <div className="stack">
        <section>
          <h2 className="section-title">This deployment</h2>
          {backend.reachable ? (
            <p className="notice notice--info">
              <strong>Connected to a live backend.</strong> Searches run the
              real pipeline against the upstream APIs. <br />
              <span className="mono">{backend.detail}</span>
            </p>
          ) : backend.configured ? (
            <p className="notice notice--error">
              <strong>Backend configured but unreachable.</strong> Searches will
              fail until it responds. <br />
              <span className="mono">{backend.detail}</span>
            </p>
          ) : (
            <p className="notice notice--warn">
              <strong>Running standalone on bundled sample data.</strong> No
              pipeline backend is configured, so every result you see is
              illustrative rather than a live API response. Set{" "}
              <code className="mono">PIPELINE_API_URL</code> to the deployed
              FastAPI service to switch this deployment to live data.
            </p>
          )}
        </section>

        <section>
          <h2 className="section-title">Stages</h2>
          <div className="stack" style={{ gap: 12 }}>
            {STAGES.map((stage, index) => (
              <div className="card" key={stage.name}>
                <div className="row" style={{ marginBottom: 8 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "var(--accent-tint)",
                      color: "var(--accent-press)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}
                  </span>
                  <strong style={{ fontSize: 15.5 }}>{stage.name}</strong>
                  <span className="badge badge--neutral mono">{stage.module}</span>
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    fontSize: 13.5,
                    maxWidth: "74ch",
                  }}
                >
                  {stage.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="section-title">Connectors</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Yields</th>
                  <th>Endpoint</th>
                  <th>Key required</th>
                </tr>
              </thead>
              <tbody>
                {SOURCES.map((source) => (
                  <tr key={source.key}>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <span
                        className="chip__dot"
                        style={{
                          background: `var(${source.colorVar})`,
                          display: "inline-block",
                          marginRight: 7,
                        }}
                      />
                      {source.label}
                    </td>
                    <td>{source.yields}</td>
                    <td className="mono" style={{ color: "var(--muted)" }}>
                      {source.endpoint}
                    </td>
                    <td>
                      <span className="badge badge--ok">no</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="section-title">HTTP API</h2>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Returns</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["GET", "/health", "service status and version"],
                  ["GET", "/sources", "the registered connector names"],
                  ["POST", "/run", "a live pipeline run for one entity"],
                  ["GET", "/demo", "a pre-baked result, no network required"],
                ].map(([method, path, returns]) => (
                  <tr key={path}>
                    <td>
                      <span className="badge badge--neutral">{method}</span>
                    </td>
                    <td className="mono">{path}</td>
                    <td style={{ color: "var(--muted)" }}>{returns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="section-title">Connecting a backend</h2>
          <div className="card">
            <ol
              style={{
                margin: 0,
                paddingLeft: 20,
                color: "var(--muted)",
                fontSize: 13.5,
                lineHeight: 1.9,
              }}
            >
              <li>
                Deploy the FastAPI service — the repository ships a{" "}
                <code className="mono">Dockerfile</code> and a{" "}
                <code className="mono">render.yaml</code> for a one-click Render
                deploy.
              </li>
              <li>
                Set <code className="mono">PIPELINE_API_URL</code> in this
                frontend&rsquo;s environment to the service&rsquo;s base URL. The{" "}
                <code className="mono">/run</code> route proxies to it, so the
                browser never talks to the backend directly and no CORS
                configuration is needed.
              </li>
              <li>
                Redeploy. This page will report{" "}
                <em>Connected to a live backend</em> once the health check
                passes.
              </li>
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}
