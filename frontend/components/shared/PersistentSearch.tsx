"use client";

// The persistent search field. Renders large and centered when asked (the
// homepage hero) and compact otherwise (the header on every other route).
// Submitting routes to the canonical company page for the query.

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Takes a variant and optional autofocus. Returns a search field that routes
 * to /company/[query] on submit.
 */
export function PersistentSearch({
  variant = "compact",
  autoFocus = false,
}: {
  variant?: "hero" | "compact";
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  /** Routes to the company page for the trimmed query. */
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    router.push(`/company/${encodeURIComponent(value)}`);
  }

  if (variant === "hero") {
    return (
      <form onSubmit={submit}>
        <div className="search-bar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search any public company or ticker"
            aria-label="Search any public company or ticker"
            autoComplete="organization"
            autoFocus={autoFocus}
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!query.trim()}
          >
            Search
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="header-search">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search a company"
        aria-label="Search a company"
      />
    </form>
  );
}
