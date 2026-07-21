"use client";

// the persistent chrome every route renders inside: one fixed glass header
// carrying the brand, the view tabs, and a pill naming the dossier currently
// loaded. mirrors the single-axis nav bar pattern — logo left, tabs inline,
// status right — rather than stacking a second sub-nav.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useRun } from "@/lib/store";

export const NAV: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/search", label: "Search" },
  { href: "/records", label: "Records" },
  { href: "/sources", label: "Sources" },
  { href: "/analytics", label: "Analytics" },
  { href: "/compare", label: "Compare" },
  { href: "/exports", label: "Exports" },
  { href: "/pipeline", label: "Pipeline" },
];

// The five satellite nodes of the brand glyph, at 72° intervals on a radius of
// 8.5 around (12, 12). Precomputed and rounded rather than derived with
// Math.cos/Math.sin at render time: Node and V8 disagree on the last float
// digit, which React reports as a hydration mismatch on every page load.
const LOGO_NODES: [number, number][] = [
  [20.5, 12],
  [14.627, 20.084],
  [5.123, 16.996],
  [5.123, 7.004],
  [14.627, 3.916],
];

// takes: an optional pixel size
// does: draws the node-graph brand glyph used in the header
// returns: the logo svg element
function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      {LOGO_NODES.map(([x, y]) => (
        <g key={`${x},${y}`}>
          <line
            x1="12"
            y1="12"
            x2={x}
            y2={y}
            stroke="currentColor"
            strokeWidth="1.1"
          />
          <circle cx={x} cy={y} r="1.8" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

// takes: the current pathname and a nav href
// does: treats "/" as an exact match and every other route as a prefix, so
//       nested routes still light their parent tab
// returns: whether the tab should read as active
function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// takes: the loaded run from the store
// does: renders the right-hand pill naming the current dossier, colour-coded
//       green for a live pipeline run and amber for bundled sample data
// returns: the status pill, or nothing when no dossier is loaded yet
function EntityPill() {
  const { run, loading } = useRun();

  if (loading) {
    return (
      <div className="shell-entity" aria-live="polite">
        <span
          className="shell-entity__dot"
          style={{ background: "var(--accent)" }}
        />
        <span className="shell-entity__name">Running…</span>
      </div>
    );
  }
  if (!run) return null;

  const live = run.mode === "live";
  return (
    <Link
      href="/search"
      className="shell-entity"
      title={live ? "Live pipeline run" : "Bundled demo data"}
    >
      <span
        className="shell-entity__dot"
        style={{ background: live ? "var(--pos)" : "var(--warn)" }}
      />
      <span className="shell-entity__name">{run.response.entity}</span>
      <span style={{ color: "var(--faint)", fontVariantNumeric: "tabular-nums" }}>
        {run.response.count}
      </span>
    </Link>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";

  return (
    <>
      <header className="shell-header">
        <Link href="/" className="shell-brand" aria-label="Dossier home">
          <LogoMark />
          <span>Dossier</span>
        </Link>

        <nav className="shell-nav" aria-label="Primary">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="shell-tab"
                data-active={active}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <EntityPill />
      </header>

      {children}
    </>
  );
}
