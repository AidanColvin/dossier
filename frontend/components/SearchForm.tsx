"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { RunRequest } from "@/lib/types";
import { sourceLabel } from "@/lib/format";

const ALL_SOURCES = ["sec_edgar", "openalex", "clinicaltrials", "nih_reporter"];

interface Props {
  loading: boolean;
  onRun: (request: RunRequest) => void;
  onDemo: (entity: string) => void;
}

export default function SearchForm({ loading, onRun, onDemo }: Props) {
  const [entity, setEntity] = useState("NVIDIA");
  const [ticker, setTicker] = useState("NVDA");
  const [selected, setSelected] = useState<string[]>(ALL_SOURCES);
  const [maxResults, setMaxResults] = useState(10);

  function toggleSource(source: string) {
    setSelected((prev) =>
      prev.includes(source)
        ? prev.filter((item) => item !== source)
        : [...prev, source]
    );
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onRun({
      entity: entity.trim(),
      ticker: ticker.trim(),
      sources: selected.length === ALL_SOURCES.length ? null : selected,
      max_results: maxResults,
    });
  }

  return (
    <form className="search" onSubmit={handleSubmit}>
      <div className="search__row">
        <label className="field">
          <span>Entity</span>
          <input
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            placeholder="Company or organization"
            required
          />
        </label>
        <label className="field field--small">
          <span>Ticker</span>
          <input
            value={ticker}
            onChange={(event) => setTicker(event.target.value)}
            placeholder="NVDA"
          />
        </label>
        <label className="field field--small">
          <span>Per source</span>
          <input
            type="number"
            min={1}
            max={50}
            value={maxResults}
            onChange={(event) => setMaxResults(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="search__sources">
        {ALL_SOURCES.map((source) => (
          <button
            type="button"
            key={source}
            className={`chip ${selected.includes(source) ? "chip--on" : ""}`}
            onClick={() => toggleSource(source)}
            aria-pressed={selected.includes(source)}
          >
            {sourceLabel(source)}
          </button>
        ))}
      </div>

      <div className="search__actions">
        <button className="btn btn--primary" type="submit" disabled={loading}>
          {loading ? "Running…" : "Run live"}
        </button>
        <button
          className="btn"
          type="button"
          disabled={loading}
          onClick={() => onDemo(entity.trim() || "NVIDIA")}
        >
          Load demo data
        </button>
      </div>
    </form>
  );
}
