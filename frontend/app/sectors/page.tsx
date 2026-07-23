"use client";

// the sector scan page at /sectors. type an industry, watch the scan stream
// in (resolved, one progress tick per company, building, verifying), then
// read the finished report. the same rendering path serves both the live
// backend and the bundled sample; only the banner differs.

import { useCallback, useRef, useState } from "react";
import { PageHead } from "@/components/ui";
import { SectorReportView } from "@/components/sector/SectorReportView";
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

  return (
    <main className="page page--wide">
      <div className="canvas">
        <PageHead title="Sector scan">
          Type an industry. Every company in it gets the full pipeline: SEC
          filings, research, trials, and grants, with sources cited.
        </PageHead>

        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(event) => {
            event.preventDefault();
            void scan(sector);
          }}
        >
          <input
            type="text"
            value={sector}
            onChange={(event) => setSector(event.target.value)}
            placeholder="semiconductors, pharma, banking..."
            aria-label="Sector to scan"
            maxLength={80}
            style={{ flex: 1 }}
          />
          <button type="submit" className="button" disabled={running}>
            {running ? "Scanning" : "Scan"}
          </button>
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
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {progress.tickers.map((ticker) => (
                  <span
                    key={ticker}
                    className="badge badge--neutral"
                    style={{
                      opacity: progress.finished.includes(ticker) ? 1 : 0.45,
                    }}
                  >
                    {ticker}
                  </span>
                ))}
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
            <SectorReportView report={report} />
          </div>
        )}
      </div>
    </main>
  );
}
