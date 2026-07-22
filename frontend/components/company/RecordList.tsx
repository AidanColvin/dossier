"use client";

// The record list, as a section of the company page rather than a route. Keeps
// the search input, source and type chips, and the List / Table toggle. When a
// year is active it filters to that year and shows a clearable chip. Defaults
// to List and to the first ten records with a "Show all" expander.

import { useMemo, useState } from "react";
import { countBy, provenanceCount } from "@/lib/analytics";
import { formatDate, sourceLabel, typeLabel } from "@/lib/format";
import type { PipelineRecord } from "@/lib/types";

const INITIAL_ROWS = 10;

type SortKey = "date" | "title" | "source" | "type";
type Verification = "all" | "verified" | "unverified";

/**
 * Takes records, the active year, and a clear handler. Returns the filterable
 * record section.
 */
export function RecordList({
  records,
  activeYear,
  onClearYear,
}: {
  records: PipelineRecord[];
  activeYear: number | null;
  onClearYear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [verification, setVerification] = useState<Verification>("all");
  const [dense, setDense] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [ascending, setAscending] = useState(false);

  const sourceBuckets = useMemo(
    () => countBy(records, (record) => record.source),
    [records]
  );
  const typeBuckets = useMemo(
    () => countBy(records, (record) => record.record_type),
    [records]
  );

  /** Adds or removes a value from a chip selection. */
  function toggle(
    setter: (updater: (current: string[]) => string[]) => void,
    value: string
  ) {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = records.filter((record) => {
      if (activeYear !== null && record.date.slice(0, 4) !== String(activeYear))
        return false;
      if (sources.length && !sources.includes(record.source)) return false;
      if (types.length && !types.includes(record.record_type)) return false;
      if (verification === "verified" && !record.verified) return false;
      if (verification === "unverified" && record.verified) return false;
      if (!needle) return true;
      return (
        record.title.toLowerCase().includes(needle) ||
        record.native_id.toLowerCase().includes(needle) ||
        record.entity.toLowerCase().includes(needle)
      );
    });

    const direction = ascending ? 1 : -1;
    return [...matched].sort((a, b) => {
      switch (sortKey) {
        case "title":
          return a.title.localeCompare(b.title) * direction;
        case "source":
          return a.source.localeCompare(b.source) * direction;
        case "type":
          return a.record_type.localeCompare(b.record_type) * direction;
        default:
          return a.date.localeCompare(b.date) * direction;
      }
    });
  }, [records, query, sources, types, verification, activeYear, sortKey, ascending]);

  /** Sorts by a column, flipping direction when it is already active. */
  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setAscending((current) => !current);
    } else {
      setSortKey(key);
      setAscending(key !== "date");
    }
  }

  const visible = expanded ? filtered : filtered.slice(0, INITIAL_ROWS);
  const hidden = filtered.length - visible.length;

  return (
    <section id="records">
      <div className="row" style={{ marginBottom: 16 }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Records
        </h2>
        <span className="spacer" />
        <div className="segmented">
          <button type="button" data-active={!dense} onClick={() => setDense(false)}>
            List
          </button>
          <button type="button" data-active={dense} onClick={() => setDense(true)}>
            Table
          </button>
        </div>
      </div>

      <div className="record-controls">
        <input
          className="input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles and identifiers"
          aria-label="Search records"
        />
        <div className="row" style={{ marginTop: 12 }}>
          {sourceBuckets.map((bucket) => (
            <button
              key={bucket.key}
              type="button"
              className="chip"
              data-active={sources.includes(bucket.key)}
              aria-pressed={sources.includes(bucket.key)}
              onClick={() => toggle(setSources, bucket.key)}
            >
              {sourceLabel(bucket.key)}
              <span style={{ color: "var(--faint)" }}>{bucket.count}</span>
            </button>
          ))}
          {typeBuckets.map((bucket) => (
            <button
              key={bucket.key}
              type="button"
              className="chip"
              data-active={types.includes(bucket.key)}
              aria-pressed={types.includes(bucket.key)}
              onClick={() => toggle(setTypes, bucket.key)}
            >
              {typeLabel(bucket.key)}
              <span style={{ color: "var(--faint)" }}>{bucket.count}</span>
            </button>
          ))}
          <div className="segmented" style={{ marginLeft: "auto" }}>
            {(["all", "verified", "unverified"] as Verification[]).map((value) => (
              <button
                key={value}
                type="button"
                data-active={verification === value}
                onClick={() => setVerification(value)}
              >
                {value === "all" ? "All" : value}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeYear !== null && (
        <div className="filter-chip">
          Filtered to {activeYear}
          <button type="button" onClick={onClearYear} aria-label="Clear year filter">
            Clear
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty">No records match these filters.</p>
      ) : dense ? (
        <RecordTable
          records={visible}
          sortKey={sortKey}
          ascending={ascending}
          onSort={sortBy}
        />
      ) : (
        <div className="card card--flush" style={{ marginTop: 4 }}>
          {visible.map((record) => (
            <RecordRow key={`${record.source}:${record.native_id}`} record={record} />
          ))}
        </div>
      )}

      {hidden > 0 && (
        <button
          type="button"
          className="btn btn--sm show-all"
          onClick={() => setExpanded(true)}
        >
          Show all {filtered.length}
        </button>
      )}
    </section>
  );
}

// Human-readable verification labels, keyed by the connector's match method.
const VERIFY_LABEL: Record<string, string> = {
  cik_match: "Verified · CIK match",
  sponsor_match: "Verified · Sponsor match",
  awardee_match: "Verified · Awardee match",
  author_affiliation: "Verified · Author affiliation",
};

/** Takes a record. Returns its verification pill text and whether it is strict. */
function verifyLabel(record: PipelineRecord): { text: string; strict: boolean } {
  const method = record.verification?.method;
  const strict = record.verification?.strict ?? record.verified;
  if (strict && method && VERIFY_LABEL[method]) {
    return { text: VERIFY_LABEL[method], strict: true };
  }
  return { text: "Unverified", strict: false };
}

/** Takes a record. Returns one list row. */
function RecordRow({ record }: { record: PipelineRecord }) {
  const { text, strict } = verifyLabel(record);
  return (
    <div className="record record--roomy">
      <div className="record__body">
        <div className="record__title">
          {record.url ? (
            <a href={record.url} target="_blank" rel="noopener noreferrer">
              {record.title}
            </a>
          ) : (
            record.title
          )}
        </div>
        <div className="record__meta">
          <span>{sourceLabel(record.source)}</span>
          <span className="record__dot">·</span>
          <span>{typeLabel(record.record_type)}</span>
          <span className="record__dot">·</span>
          <span>{formatDate(record.date)}</span>
          <span className={`pill ${strict ? "pill--verified" : "pill--source"}`}>
            {text}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Takes records and sort state. Returns the dense table view. */
function RecordTable({
  records,
  sortKey,
  ascending,
  onSort,
}: {
  records: PipelineRecord[];
  sortKey: SortKey;
  ascending: boolean;
  onSort: (key: SortKey) => void;
}) {
  const arrow = (key: SortKey) => (key === sortKey ? (ascending ? " ↑" : " ↓") : "");
  return (
    <div className="table-wrap" style={{ marginTop: 4 }}>
      <table className="data">
        <thead>
          <tr>
            <th data-sortable="true" onClick={() => onSort("source")}>
              Source{arrow("source")}
            </th>
            <th data-sortable="true" onClick={() => onSort("type")}>
              Type{arrow("type")}
            </th>
            <th data-sortable="true" onClick={() => onSort("date")}>
              Date{arrow("date")}
            </th>
            <th data-sortable="true" onClick={() => onSort("title")}>
              Title{arrow("title")}
            </th>
            <th>Provenance</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={`${record.source}:${record.native_id}`}>
              <td style={{ whiteSpace: "nowrap" }}>{sourceLabel(record.source)}</td>
              <td style={{ whiteSpace: "nowrap" }}>{typeLabel(record.record_type)}</td>
              <td style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {formatDate(record.date)}
              </td>
              <td style={{ minWidth: 260 }}>
                {record.url ? (
                  <a href={record.url} target="_blank" rel="noopener noreferrer">
                    {record.title}
                  </a>
                ) : (
                  record.title
                )}
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                <span
                  className={`pill ${
                    record.verified ? "pill--verified" : "pill--source"
                  }`}
                >
                  {provenanceCount(record)} src
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
