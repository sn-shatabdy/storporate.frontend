"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { matchFailureOf, type MatchFailure } from "./matching-helpers";

const DEBOUNCE_MS = 400;

/**
 * Loads a list of matches for the signed in user and re-loads it a moment
 * after the search text stops changing. Clearing the text loads at once. The
 * previous list stays on screen while a new one loads.
 *
 * Pass a stable `load` (module function or `useCallback`).
 */
export function useMatchResults<T>(
  load: (token: string, q: string, signal: AbortSignal) => Promise<{ items: T[] }>,
  enabled = true,
) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<MatchFailure | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const trimmed = text.trim();
    const timer = setTimeout(() => setQuery(trimmed), trimmed ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (!accessToken || !enabled) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setFailure(null);
      try {
        const result = await load(accessToken, query, controller.signal);
        if (controller.signal.aborted) return;
        setItems(result.items);
        setLoading(false);
      } catch (error) {
        if (controller.signal.aborted) return;
        setFailure(matchFailureOf(error));
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [accessToken, enabled, load, query, version]);

  return {
    text,
    setText,
    /** The trimmed text the current list was asked for. */
    query,
    items,
    loading,
    failure,
    retry: () => setVersion((v) => v + 1),
  };
}
