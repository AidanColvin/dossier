"use client";

// The persistent search field. Renders large and centered when asked (the
// homepage hero) and compact otherwise (the header on every other route).
// Submitting routes to the full deep-dive report for the query; the
// interactive dossier stays one click away from the report header.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Placeholder prompts the hero search cycles through, teaching the input space
// by example: a company name, a ticker, and a raw CIK.
const HERO_PROMPTS = [
  "Search any public company or ticker",
  "Apple",
  "MSFT",
  "Moderna",
  "0000320193",
];
const ROTATE_MS = 3000;

/**
 * Takes a variant and optional autofocus. Returns a search field that routes
 * to /report/[query] on submit.
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
  const [promptIndex, setPromptIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  // Rotate the hero placeholder, pausing while the field is focused or has
  // text, so the rotation never fights the user.
  useEffect(() => {
    if (variant !== "hero" || focused || query) return;
    const timer = window.setInterval(
      () => setPromptIndex((index) => (index + 1) % HERO_PROMPTS.length),
      ROTATE_MS
    );
    return () => window.clearInterval(timer);
  }, [variant, focused, query]);

  /** Routes to the deep-dive report for the trimmed query. */
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    router.push(`/report/${encodeURIComponent(value)}`);
  }

  if (variant === "hero") {
    return (
      <form onSubmit={submit}>
        <div className="search-bar">
          <input
            data-hero-search
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={HERO_PROMPTS[promptIndex]}
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
        data-header-search
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search a company"
        aria-label="Search a company"
      />
    </form>
  );
}
