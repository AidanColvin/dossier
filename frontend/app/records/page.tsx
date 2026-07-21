"use client";

// Records — the explorer. Every normalized record in the loaded dossier,
// filterable by source, type and verification state, free-text searchable,
// sortable, and switchable between a reading list and a dense table.

import { useMemo, useState } from "react";
import { countBy, provenanceCount } from "@/lib/analytics";
import { formatDate, sourceLabel, typeLabel } from "@/lib/format";
import { sourceColor } from "@/lib/sources";
import { useEnsureRun } from "@/lib/store";
import type { PipelineRecord } from "@/lib/types";
import {
  Empty,
  LoadingRows,
  ModeNotice,
  PageHead,
  RecordRow,
  SourceChip,
} from "@/components/ui";

type SortKey = "date" | "title" | "source" | "type";
type Verification = "all" | "verified" | "unverified";

export default function RecordsPage() {
  const { run, loading } = useEnsureRun();
  const records = run?.response.records ?? [];

  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [verification, setVerification] = useState<Verification>("all");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [ascending, setAscending] = useState(false);
  const [dense, setDense] = useState(false);

  const sourceBuckets = useMemo(
    () => countBy(records, (record) => record.source),
    [records]
  );
  const typeBuckets = useMemo(
    () => countBy(records, (record) => record.record_type),
    [records]
  );

  // takes: the current selection and a value
  // does: adds or removes the value — an empty selection means "no filter",
  //       which is why it is allowed here but not on the Search form
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

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = records.filter((record) => {
      if (sources.length && !sources.includes(record.source)) return false;
      if (types.length && !types.includes(record.record_type)) return false;
      if (verification === "verified" && !record.verified) return false;
      if (verification === "unverified" && record.verified) return false;
      if (!needle) return true;
      // Search the fields a person would actually recognise a record by.
      return (
        record.title.toLowerCase().includes(needle) ||
        record.native_id.toLowerCase().includes(needle) ||
        record.entity.toLowerCase().includes(needle)
      );
    });

    const direction = ascending ? 1 : -1;
    return [...filtered].sort((a, b) => {
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
  }, [records, query, sources, types, verification, sortKey, ascending]);

  // takes: the column a header represents
  // does: sorts by it, or flips the direction when it is already the sort key
  function sortBy(key: SortKey) {
    if (key === sortKey) {
      setAscending((current) => !current);
    } else {
      setSortKey(key);
      setAscending(key === "title" || key === "source" || key === "type");
    }
  }

  const filtersActive =
    Boolean(query.trim()) ||
    sources.length > 0 ||
    types.length > 0 ||
    verification !== "all";

  return (
    <main className="page page--wide">
      <PageHead title="Records">
        {run
          ? `${records.length} normalized records for ${run.response.entity}, deduplicated across every connector that responded.`
          : "Every normalized record in the loaded dossier."}
      </PageHead>

      <div className="stack">
        <ModeNotice run={run} />

        <div className="card">
          <div className="field" style={{ marginBottom: 16 }}>
            <label className="field__label" htmlFor="record-search">
              Search titles and identifiers
            </label>
            <input
              id="record-search"
              className="input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="10-K, transformer, NCT…"
            />
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <span className="field__label">Source</span>
            <div className="row">
              {sourceBuckets.map((bucket) => (
                <SourceChip
                  key={bucket.key}
                  source={bucket.key}
                  count={bucket.count}
                  active={sources.includes(bucket.key)}
                  onClick={() => toggle(setSources, bucket.key)}
                />
              ))}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 14 }}>
            <span className="field__label">Type</span>
            <div className="row">
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
            </div>
          </div>

          <div className="row">
            <div className="segmented">
              {(["all", "verified", "unverified"] as Verification[]).map(
                (value) => (
                  <button
                    key={value}
                    type="button"
                    data-active={verification === value}
                    onClick={() => setVerification(value)}
                  >
                    {value === "all" ? "All" : value}
                  </button>
                )
              )}
            </div>

            <div className="segmented">
              <button
                type="button"
                data-active={!dense}
                onClick={() => setDense(false)}
              >
                List
              </button>
              <button
                type="button"
                data-active={dense}
                onClick={() => setDense(true)}
              >
                Table
              </button>
            </div>

            <span className="spacer" />

            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              {visible.length} of {records.length}
            </span>
            {filtersActive && (
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => {
                  setQuery("");
                  setSources([]);
                  setTypes([]);
                  setVerification("all");
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {loading && records.length === 0 ? (
          <LoadingRows rows={8} />
        ) : visible.length === 0 ? (
          <Empty>
            {records.length === 0
              ? "No dossier loaded yet."
              : "No records match these filters."}
          </Empty>
        ) : dense ? (
          <RecordTable
            records={visible}
            sortKey={sortKey}
            ascending={ascending}
            onSort={sortBy}
          />
        ) : (
          <div className="card card--flush">
            {visible.map((record) => (
              <RecordRow
                key={`${record.source}:${record.native_id}`}
                record={record}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// takes: the visible records plus the current sort state
// does: renders the dense table view, with clickable sortable headers
// returns: the table element
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
  const arrow = (key: SortKey) =>
    key === sortKey ? (ascending ? " ↑" : " ↓") : "";

  return (
    <div className="table-wrap">
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
            <th>Identifier</th>
            <th>Provenance</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={`${record.source}:${record.native_id}`}>
              <td style={{ whiteSpace: "nowrap" }}>
                <span
                  className="chip__dot"
                  style={{
                    background: sourceColor(record.source),
                    display: "inline-block",
                    marginRight: 7,
                  }}
                />
                {sourceLabel(record.source)}
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                {typeLabel(record.record_type)}
              </td>
              <td
                style={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
              >
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
              <td className="mono" style={{ color: "var(--muted)" }}>
                {record.native_id}
              </td>
              <td style={{ whiteSpace: "nowrap" }}>
                <span
                  className={`badge ${
                    record.verified ? "badge--ok" : "badge--warn"
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
