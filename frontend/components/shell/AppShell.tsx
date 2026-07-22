"use client";

// The persistent chrome for every route: a single slim header with the logo,
// a search field, and an info icon. The seven tab nav is gone. The info icon
// opens the how it works panel, which also opens when a legacy route redirects
// here with ?info=1.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { PersistentSearch } from "@/components/shared/PersistentSearch";
import { InfoSlideOver } from "@/components/shared/InfoSlideOver";

/** Takes a size. Returns the node-graph brand glyph. */
function LogoMark({ size = 20 }: { size?: number }) {
  const nodes: [number, number][] = [
    [20.5, 12],
    [14.627, 20.084],
    [5.123, 16.996],
    [5.123, 7.004],
    [14.627, 3.916],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      {nodes.map(([x, y]) => (
        <g key={`${x},${y}`}>
          <line x1="12" y1="12" x2={x} y2={y} stroke="currentColor" strokeWidth="1.1" />
          <circle cx={x} cy={y} r="1.8" fill="currentColor" />
        </g>
      ))}
    </svg>
  );
}

/** Takes nothing. Returns the round info button glyph. */
function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 11v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.6" r="1.05" fill="currentColor" />
    </svg>
  );
}

/**
 * Reads ?info=1 once and opens the panel, so legacy source links land here.
 * Guarded so it fires a single time: without the guard, every re-render would
 * reopen the panel and it could never be closed while the param remains.
 */
function InfoFromQuery({ onOpen }: { onOpen: () => void }) {
  const params = useSearchParams();
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    if (params.get("info") === "1") {
      fired.current = true;
      onOpen();
    }
  }, [params, onOpen]);
  return null;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isHome = pathname === "/";
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <header className="shell-header shell-header--slim">
        <Link href="/" className="shell-brand" aria-label="Dossier home">
          <LogoMark />
          <span>Dossier</span>
        </Link>

        <div className="shell-header__search">
          {/* The homepage owns the big centered search, so the header search
              only appears on the other routes. */}
          {!isHome && <PersistentSearch variant="compact" />}
        </div>

        <button
          type="button"
          className="shell-info"
          aria-label="How it works"
          onClick={() => setInfoOpen(true)}
        >
          <InfoIcon />
        </button>
      </header>

      <Suspense fallback={null}>
        <InfoFromQuery onOpen={() => setInfoOpen(true)} />
      </Suspense>

      {children}

      <InfoSlideOver open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}
