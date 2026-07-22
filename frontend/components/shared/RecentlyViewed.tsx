"use client";

// The "recently viewed" strip on the homepage. Renders only when the visitor
// has opened two or more companies before, so a first-time visitor never sees
// an empty shell. Reads from localStorage after mount to keep the server and
// client markup in agreement.

import Link from "next/link";
import { useEffect, useState } from "react";
import { readRecentlyViewed, type RecentCompany } from "@/lib/storage/recentlyViewed";

/** Takes nothing. Returns the recently-viewed strip, or nothing. */
export function RecentlyViewed() {
  const [items, setItems] = useState<RecentCompany[]>([]);

  useEffect(() => {
    setItems(readRecentlyViewed());
  }, []);

  if (items.length < 2) return null;

  return (
    <section className="section-band">
      <div className="canvas__eyebrow" style={{ marginBottom: 14 }}>
        Recently viewed
      </div>
      <div className="recent-row">
        {items.slice(0, 3).map((item) => (
          <Link
            key={item.ticker}
            href={`/company/${item.ticker}`}
            className="recent-card"
          >
            <span className="recent-card__name">{item.name}</span>
            <span className="fact-banner__ticker">{item.ticker}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
