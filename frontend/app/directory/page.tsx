"use client";

// the company directory at /directory. every sec-listed company as a live
// table: search by name or ticker, filter by exchange, click a header to
// sort, download the filtered set as csv, and click any row to open that
// company's dossier.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Empty, LoadingRows, PageHead } from "@/components/ui";
import { download } from "@/lib/exports";
import type { DirectoryCompany } from "@/lib/sampleDirectory";
import type { RunMode } from "@/lib/types";
import { buildXlsx } from "@/lib/xlsx";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 250;

interface DirectoryData {
  total: number;
  exchanges: string[];
  companies: DirectoryCompany[];
}

const COLUMNS: Array<{ key: string; label: string }> = [
  { key: "ticker", label: "Ticker" },
  { key: "name", label: "Company" },
  { key: "exchange", label: "Exchange" },
  { key: "cik", label: "CIK" },
];

const EXPORT_HEADER = ["Ticker", "Company", "Exchange", "CIK"];

/** given the filtered companies, return [header, ...rows] as plain strings */
function exportRows(companies: DirectoryCompany[]): string[][] {
  return [EXPORT_HEADER,
          ...companies.map((c) => [c.ticker, c.name, c.exchange, c.cik])];
}

/**
 * given the filtered companies
 * return them as csv text, mirroring the backend export's columns
 */
function toCsv(companies: DirectoryCompany[]): string {
  const rows = companies.map((c) =>
    [c.cik, `"${c.name.replaceAll('"', '""')}"`, c.ticker, c.exchange].join(",")
  );
  return ["cik,name,ticker,exchange", ...rows].join("\n");
}

/**
 * given the filtered companies
 * return them as a markdown table
 */
function toMarkdown(companies: DirectoryCompany[]): string {
  const lines = [
    `| ${EXPORT_HEADER.join(" | ")} |`,
    `|${EXPORT_HEADER.map(() => "---").join("|")}|`,
    ...companies.map((c) => `| ${c.ticker} | ${c.name} | ${c.exchange} | ${c.cik} |`),
  ];
  return lines.join("\n");
}

export default function DirectoryPage() {
  const [search, setSearch] = useState("");
  const [exchange, setExchange] = useState("");
  const [sort, setSort] = useState("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<DirectoryData | null>(null);
  const [mode, setMode] = useState<RunMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (params: {
      search: string;
      exchange: string;
      sort: string;
      order: string;
      offset: number;
    }) => {
      setLoading(true);
      setError("");
      try {
        const query = new URLSearchParams({
          search: params.search,
          exchange: params.exchange,
          sort: params.sort,
          order: params.order,
          limit: String(PAGE_SIZE),
          offset: String(params.offset),
        });
        const response = await fetch(`/companies?${query}`);
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { detail?: string };
          throw new Error(body.detail ?? `directory failed (${response.status})`);
        }
        setMode(response.headers.get("x-dossier-mode") === "live" ? "live" : "demo");
        setData((await response.json()) as DirectoryData);
      } catch (caught) {
        setError((caught as Error).message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // the search box debounces; every other control reloads at once. offset
  // resets whenever the query itself changes, so a filter change never
  // strands the visitor on an empty page.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void load({ search, exchange, sort, order, offset });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, exchange, sort, order, offset, load]);

  const setQuery = (updates: Partial<{ search: string; exchange: string; sort: string; order: "asc" | "desc" }>) => {
    if (updates.search !== undefined) setSearch(updates.search);
    if (updates.exchange !== undefined) setExchange(updates.exchange);
    if (updates.sort !== undefined) setSort(updates.sort);
    if (updates.order !== undefined) setOrder(updates.order);
    setOffset(0);
  };

  const downloadCsv = () => {
    if (!data) return;
    download(toCsv(data.companies), "dossier-directory.csv", "text/csv");
  };

  const downloadMarkdown = () => {
    if (!data) return;
    download(toMarkdown(data.companies), "dossier-directory.md", "text/markdown");
  };

  const downloadExcel = () => {
    if (!data) return;
    const bytes = buildXlsx("Directory", exportRows(data.companies));
    download(bytes, "dossier-directory.xlsx",
             "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  };

  return (
    <main className="page page--wide">
      <div className="canvas">
        <PageHead
          title="Company directory"
          actions={
            <div className="row no-print" style={{ gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="chip" onClick={downloadCsv} disabled={!data}>
                CSV
              </button>
              <button type="button" className="chip" onClick={downloadExcel} disabled={!data}>
                Excel
              </button>
              <button type="button" className="chip" onClick={() => window.print()} disabled={!data}>
                PDF
              </button>
              <button type="button" className="chip" onClick={downloadMarkdown} disabled={!data}>
                Markdown
              </button>
            </div>
          }
        >
          Every SEC-listed company. Search, filter, sort, and open any row as
          a full dossier.
        </PageHead>

        <div className="row no-print" style={{ gap: 8, flexWrap: "wrap" }}>
          <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
            <input
              type="text"
              value={search}
              onChange={(event) => setQuery({ search: event.target.value })}
              placeholder="Search name or ticker"
              aria-label="Search the directory"
              maxLength={80}
            />
          </div>
          <button
            type="button"
            className="chip"
            data-active={exchange === ""}
            onClick={() => setQuery({ exchange: "" })}
          >
            All exchanges
          </button>
          {(data?.exchanges ?? []).map((name) => (
            <button
              key={name}
              type="button"
              className="chip"
              data-active={exchange === name}
              onClick={() => setQuery({ exchange: name })}
            >
              {name}
            </button>
          ))}
        </div>

        {error && <p className="notice notice--error">{error}</p>}

        {mode === "demo" && data && (
          <p className="notice notice--info" style={{ marginTop: 12 }}>
            No pipeline backend is configured, so this is a bundled sample of
            the directory. Connect PIPELINE_API_URL for every listed company.
          </p>
        )}

        {data && (
          <p className="count-line" style={{ marginTop: 12 }}>
            {data.total.toLocaleString()} companies
            {data.total > PAGE_SIZE &&
              ` · showing ${offset + 1}-${Math.min(offset + PAGE_SIZE, data.total)}`}
          </p>
        )}

        {loading && !data && <LoadingRows rows={8} />}

        {data && data.companies.length === 0 && (
          <Empty>No companies match.</Empty>
        )}

        {data && data.companies.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      data-sortable="true"
                      aria-sort={
                        sort === column.key
                          ? order === "asc"
                            ? "ascending"
                            : "descending"
                          : undefined
                      }
                      onClick={() =>
                        setQuery(
                          sort === column.key
                            ? { order: order === "asc" ? "desc" : "asc" }
                            : { sort: column.key, order: "asc" }
                        )
                      }
                    >
                      {column.label}
                      {sort === column.key && (order === "asc" ? " ↑" : " ↓")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.companies.map((company) => (
                  <tr key={company.cik + company.ticker}>
                    <td>
                      <Link href={`/company/${encodeURIComponent(company.ticker)}`}>
                        {company.ticker}
                      </Link>
                    </td>
                    <td>{company.name}</td>
                    <td>{company.exchange}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{company.cik}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > PAGE_SIZE && (
          <div className="row no-print" style={{ gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="chip"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </button>
            <button
              type="button"
              className="chip"
              disabled={offset + PAGE_SIZE >= data.total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
