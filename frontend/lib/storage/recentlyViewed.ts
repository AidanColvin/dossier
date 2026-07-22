// Local, keyless memory of the companies a visitor has opened. This is the
// machinery of a second visit: no accounts, no server, just the last few
// companies kept in localStorage so the homepage can greet a returning reader.

const KEY = "dossier.recentlyViewed";
const MAX = 5;

export interface RecentCompany {
  ticker: string;
  name: string;
  viewedAt: string;
  lastRecordCount: number;
}

/** Takes nothing. Returns the stored list, newest first, or an empty array. */
export function readRecentlyViewed(): RecentCompany[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentCompany[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Takes a company's ticker, name, and current record count. Records the visit,
 * moving it to the front and capping the list. Returns nothing.
 */
export function recordVisit(
  ticker: string,
  name: string,
  recordCount: number
): void {
  if (typeof window === "undefined" || !ticker) return;
  const key = ticker.toUpperCase();
  const existing = readRecentlyViewed().filter(
    (item) => item.ticker.toUpperCase() !== key
  );
  const next: RecentCompany[] = [
    { ticker: key, name, viewedAt: new Date().toISOString(), lastRecordCount: recordCount },
    ...existing,
  ].slice(0, MAX);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A full or blocked store is not worth surfacing; the feature is optional.
  }
}
