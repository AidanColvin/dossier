"use client";

// the one place a run lives. mounted once in the root layout, so every route
// reads the same dossier and navigating between Records, Sources and Analytics
// never refetches or loses state. the active run is mirrored into
// sessionStorage so a refresh - or a pasted deep link - lands on the same data.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { fetchDemo, runPipeline } from "./api";
import type { RunRequest, RunResult } from "./types";

const STORAGE_KEY = "dossier:run";
const COMPARE_KEY = "dossier:compare";

interface RunStore {
  run: RunResult | null;
  loading: boolean;
  error: string | null;
  /** whether the sessionStorage restore has completed. */
  hydrated: boolean;
  /** entity names held for side-by-side comparison. */
  compare: RunResult[];
  /** run the live pipeline (falls back to demo data server-side when no backend). */
  execute: (request: RunRequest) => Promise<void>;
  /** load the bundled demo dossier for an entity. */
  loadDemo: (entity: string) => Promise<void>;
  addToCompare: (result: RunResult) => void;
  removeFromCompare: (entity: string) => void;
  clearCompare: () => void;
}

const RunContext = createContext<RunStore | null>(null);

/**
 * given a storage key and a fallback
 * return the parsed session value, or the fallback when absent or corrupt -
 * a stale schema in storage must never take the app down
 */
function readSession<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeSession(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota or private-mode failures are not worth surfacing; the app works
    // fine without persistence.
  }
}

export function RunProvider({ children }: { children: ReactNode }) {
  const [run, setRun] = useState<RunResult | null>(null);
  const [compare, setCompare] = useState<RunResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Rehydration happens in an effect, one tick after mount. Until it has run,
  // `run` is null for a reason that is NOT "no dossier loaded" - so the
  // ensure-run fallback must wait, or a full page load would overwrite the
  // restored dossier with the default entity.
  const [hydrated, setHydrated] = useState(false);

  // Guards a race: if the user fires a second run while the first is still in
  // flight, only the newest response is allowed to land.
  const requestId = useRef(0);

  // Rehydrate after mount rather than during render, so the server-rendered
  // markup and the first client render agree.
  useEffect(() => {
    setRun(readSession<RunResult | null>(STORAGE_KEY, null));
    setCompare(readSession<RunResult[]>(COMPARE_KEY, []));
    setHydrated(true);
  }, []);

  const settle = useCallback((result: RunResult, id: number) => {
    if (id !== requestId.current) return;
    setRun(result);
    writeSession(STORAGE_KEY, result);
  }, []);

  const loadDemo = useCallback(
    async (entity: string) => {
      const id = (requestId.current += 1);
      setLoading(true);
      setError(null);
      try {
        const { response, mode } = await fetchDemo(entity);
        settle({ response, mode, ranAt: Date.now(), request: { entity } }, id);
      } catch (caught) {
        if (id === requestId.current) setError((caught as Error).message);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [settle]
  );

  const execute = useCallback(
    async (request: RunRequest) => {
      const id = (requestId.current += 1);
      setLoading(true);
      setError(null);
      try {
        const { response, mode } = await runPipeline(request);
        settle({ response, mode, ranAt: Date.now(), request }, id);
      } catch (caught) {
        if (id === requestId.current) {
          setError(
            `${(caught as Error).message}. The pipeline API did not respond - ` +
              "check that the backend is running and reachable."
          );
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [settle]
  );

  const addToCompare = useCallback((result: RunResult) => {
    setCompare((current) => {
      // Replace any existing entry for the same entity rather than stacking
      // duplicates, and cap the tray so the table stays readable.
      const others = current.filter(
        (item) => item.response.entity !== result.response.entity
      );
      const next = [...others, result].slice(-4);
      writeSession(COMPARE_KEY, next);
      return next;
    });
  }, []);

  const removeFromCompare = useCallback((entity: string) => {
    setCompare((current) => {
      const next = current.filter((item) => item.response.entity !== entity);
      writeSession(COMPARE_KEY, next);
      return next;
    });
  }, []);

  const clearCompare = useCallback(() => {
    setCompare([]);
    writeSession(COMPARE_KEY, []);
  }, []);

  const value = useMemo<RunStore>(
    () => ({
      run,
      loading,
      error,
      hydrated,
      compare,
      execute,
      loadDemo,
      addToCompare,
      removeFromCompare,
      clearCompare,
    }),
    [
      run,
      loading,
      error,
      hydrated,
      compare,
      execute,
      loadDemo,
      addToCompare,
      removeFromCompare,
      clearCompare,
    ]
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

/**
 * takes nothing
 * return the shared run store
 * throws when called outside RunProvider, which would otherwise show up as a
 * confusing null-property crash deep in a view
 */
export function useRun(): RunStore {
  const store = useContext(RunContext);
  if (!store) throw new Error("useRun must be used inside <RunProvider>");
  return store;
}

/**
 * given an entity name to fall back to
 * ensure a dossier is loaded: pages call this so landing directly on
 * /records or /analytics still shows something instead of an empty shell
 */
export function useEnsureRun(fallbackEntity = "NVIDIA"): RunStore {
  const store = useRun();
  const { run, loading, hydrated, loadDemo } = store;
  const requested = useRef(false);

  useEffect(() => {
    // Wait for rehydration: before it completes a null `run` only means
    // "not restored yet", and loading the fallback would clobber the dossier
    // the visitor already had on a full page load.
    if (!hydrated || run || loading || requested.current) return;
    requested.current = true;
    void loadDemo(fallbackEntity);
  }, [hydrated, run, loading, loadDemo, fallbackEntity]);

  return store;
}
