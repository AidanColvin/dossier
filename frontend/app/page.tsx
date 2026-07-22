"use client";

// The homepage. An outcome headline, one centered search, and a "start here"
// grid of six companies. Each card carries a cached lede so the grid renders
// instantly with no per-load fetching. Searching or picking a card routes to
// the canonical company page.

import Link from "next/link";
import { PersistentSearch } from "@/components/shared/PersistentSearch";
import { START_HERE } from "@/lib/startHere.data";

export default function HomePage() {
  return (
    <main className="page page--wide">
      <div className="canvas">
        <section className="hero">
          <h1>See what any public company is actually doing.</h1>
          <p>
            Filings, trials, papers, and grants for any public company, with
            citations back to the source.
          </p>
          <PersistentSearch variant="hero" autoFocus />
        </section>

        <section className="section-band">
          <div className="canvas__eyebrow" style={{ marginBottom: 20 }}>
            Start here
          </div>
          <div className="start-grid">
            {START_HERE.map((card) => (
              <Link
                key={card.ticker}
                href={`/company/${card.ticker}`}
                className="start-card"
              >
                <div className="start-card__head">
                  <strong>{card.name}</strong>
                  <span className="fact-banner__ticker">{card.ticker}</span>
                </div>
                <p className="start-card__lede">{card.lede}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
