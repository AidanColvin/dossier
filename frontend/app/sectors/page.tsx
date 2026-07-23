"use client";

// the sector scan page at /sectors. type an industry, watch the scan stream
// in (resolved, one progress tick per company, building, verifying), then
// read the finished report. the same rendering path serves both the live
// backend and the bundled sample; only the banner differs.

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHead } from "@/components/ui";
import { SaveToProject } from "@/components/shared/SaveToProject";
import { SectorReportView } from "@/components/sector/SectorReportView";
import { download } from "@/lib/exports";
import { sectorReportMarkdown } from "@/lib/reportExport";
import { streamSectorScan } from "@/lib/sectorStream";
import type {
  SectorProgressEvent,
  SectorReport,
  SectorResolvedEvent,
} from "@/lib/sectorTypes";
import type { RunMode } from "@/lib/types";

const EXAMPLES = ["semiconductors", "pharmaceuticals", "banking", "renewable energy"];

interface ScanProgress {
  total: number;
  done: number;
  tickers: string[];
  finished: string[];
  stage: string;
}

const IDLE_PROGRESS: ScanProgress = {
  total: 0,
  done: 0,
  tickers: [],
  finished: [],
  stage: "",
};

export default function SectorsPage() {
  const [sector, setSector] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>(IDLE_PROGRESS);
  const [report, setReport] = useState<SectorReport | null>(null);
  const [mode, setMode] = useState<RunMode | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const scan = useCallback(async (text: string) => {
    const query = text.trim();
    if (!query) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // the scan is bookmarkable: the query lands in the url, so a finished
    // report can be shared as a link and the recipient's visit re-runs it.
    window.history.replaceState(null, "", `/sectors?q=${encodeURIComponent(query)}`);

    setRunning(true);
    setError("");
    setReport(null);
    setProgress({ ...IDLE_PROGRESS, stage: "resolving the sector" });

    try {
      const finishedMode = await streamSectorScan(
        query,
        (kind, payload) => {
          if (kind === "resolved") {
            const event = payload as SectorResolvedEvent;
            setProgress((prev) => ({
              ...prev,
              total: event.total,
              tickers: event.tickers,
              stage: `profiling ${event.total} companies`,
            }));
          } else if (kind === "progress") {
            const event = payload as SectorProgressEvent;
            setProgress((prev) => ({
              ...prev,
              done: event.done,
              finished: [...prev.finished, event.ticker],
            }));
          } else if (kind === "building") {
            setProgress((prev) => ({ ...prev, stage: "building the report" }));
          } else if (kind === "verifying") {
            setProgress((prev) => ({ ...prev, stage: "checking sources" }));
          } else if (kind === "done") {
            setReport(payload as SectorReport);
          } else if (kind === "error") {
            const message = (payload as { message?: string }).message;
            setError(message ?? "the scan failed");
          }
        },
        controller.signal
      );
      setMode(finishedMode);
    } catch (caught) {
      if (!controller.signal.aborted) {
        setError((caught as Error).message);
      }
    } finally {
      if (abortRef.current === controller) {
        setRunning(false);
      }
    }
  }, []);

  // a deep-linked visit (?q=banking) runs its scan once on mount. reading
  // window.location directly keeps this page statically prerenderable,
  // which useSearchParams would not.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    const linked = new URLSearchParams(window.location.search).get("q");
    if (linked) {
      setSector(linked);
      void scan(linked);
    }
  }, [scan]);

  return (
    <main className="page page--wide">
      <div className="canvas">
        <PageHead title="Sector scan">
          Type an industry. Every company in it gets the full pipeline: SEC
          filings, research, trials, and grants, with sources cited.
        </PageHead>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void scan(sector);
          }}
        >
          <div className="search-bar">
            <input
              type="text"
              value={sector}
              onChange={(event) => setSector(event.target.value)}
              placeholder="semiconductors, pharma, banking..."
              aria-label="Sector to scan"
              maxLength={80}
            />
            <button type="submit" className="btn btn--primary" disabled={running}>
              {running ? "Scanning" : "Scan"}
            </button>
          </div>
        </form>

        <div className="row" style={{ gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className="chip"
              disabled={running}
              onClick={() => {
                setSector(example);
                void scan(example);
              }}
            >
              {example}
            </button>
          ))}
        </div>

        {error && <p className="notice notice--error">{error}</p>}

        {running && (
          <div className="stack" style={{ gap: 8, marginTop: 16 }} aria-live="polite">
            <p className="count-line">
              {progress.stage}
              {progress.total > 0 && ` · ${progress.done} of ${progress.total}`}
            </p>
            {progress.tickers.length > 0 && (
              <div className="grid grid--4">
                {progress.tickers.map((ticker) => {
                  const done = progress.finished.includes(ticker);
                  return (
                    <div
                      key={ticker}
                      className="stat"
                      style={{
                        opacity: done ? 1 : 0.45,
                        transition: "opacity 0.3s var(--ease)",
                      }}
                    >
                      <div className="stat__value" style={{ fontSize: 18 }}>
                        {ticker}
                      </div>
                      <div className="stat__label" style={{ textTransform: "none" }}>
                        {done ? "profiled" : "fetching"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {report && mode === "demo" && (
          <p className="notice notice--info" style={{ marginTop: 16 }}>
            No pipeline backend is configured, so this is the bundled sample
            scan. Connect PIPELINE_API_URL for live data.
          </p>
        )}

        {report && (
          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ justifyContent: "flex-end", gap: 6, marginBottom: 8 }}>
              <button
                type="button"
                className="chip"
                onClick={() =>
                  download(sectorReportMarkdown(report),
                           `sector-${report.sector.replaceAll(" ", "-")}.md`,
                           "text/markdown")
                }
              >
                Download report
              </button>
              <SaveToProject
                bundle={{
                  name: `${report.sector} scan`,
                  mode: "sector",
                  subject: report.sector,
                  sector: report,
                }}
              />
            </div>
            <SectorReportView report={report} />
          </div>
        )}
      </div>
    </main>
  );
}
