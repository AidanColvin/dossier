"use client";

import { useCallback, useEffect, useState } from "react";
import SearchForm from "@/components/SearchForm";
import ResultsDashboard from "@/components/ResultsDashboard";
import { fetchDemo, runPipeline } from "@/lib/api";
import type { RunRequest, RunResponse } from "@/lib/types";

export default function Home() {
  const [data, setData] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDemo = useCallback(async (entity: string) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await fetchDemo(entity);
      setData(result);
      setNotice("Showing bundled demo data — no network required.");
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const runLive = useCallback(async (request: RunRequest) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await runPipeline(request);
      setData(result);
    } catch (caught) {
      setError(
        `${(caught as Error).message} — is the API running at the configured URL?`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDemo("NVIDIA");
  }, [loadDemo]);

  return (
    <main className="page">
      <header className="hero">
        <h1>
          Multi-Source <span>ETL Pipeline</span>
        </h1>
        <p>
          Extract public research and company data from four keyless primary
          sources, normalize it, validate provenance, and explore it here.
        </p>
        <div className="hero__badges">
          <span>SEC EDGAR</span>
          <span>OpenAlex</span>
          <span>ClinicalTrials.gov</span>
          <span>NIH RePORTER</span>
        </div>
      </header>

      <SearchForm loading={loading} onRun={runLive} onDemo={loadDemo} />

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {loading && !data && <p className="notice">Loading…</p>}

      {data && <ResultsDashboard data={data} />}

      <footer className="footer">
        Built as a modular ETL pipeline · FastAPI backend · Next.js frontend
      </footer>
    </main>
  );
}
