"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { ApiError } from "@/lib/api/errors";
import {
  createTalentSearch,
  getTalentSearch,
  type TalentSearch,
  type TalentSearchResultItem,
} from "@/lib/api/talentSearch";

import { ExampleChips } from "@/components/talent/example-chips";
import { SearchFailedAlert } from "@/components/talent/search-failed-alert";
import { NoResultsState } from "@/components/talent/no-results-state";
import { ResultCard } from "@/components/talent/result-card";
import { SearchBox } from "@/components/talent/search-box";
import { SearchingState } from "@/components/talent/searching-state";
import {
  messageForTalentSearchError,
  resultsCountLine,
  srResultsAnnouncement,
} from "@/components/talent/helpers";

/**
 * STOR-43 Phase 4 — `/employer/search`. The employer "Find students"
 * page. The (employer) layout owns the authorization gate; this page
 * assumes the visitor is an authenticated Organization.
 *
 * State machine for the search itself:
 *   - `idle`     : no search yet, no errors. Renders the search card,
 *                  the example chips, and nothing else.
 *   - `busy`     : a POST is in flight OR a search is Pending. Renders
 *                  the search card (disabled) and the searching state
 *                  (spinner + skeletons).
 *   - `results`  : the search has Completed with at least one result.
 *                  Renders the search card and the results list.
 *   - `noResults`: the search has Completed with an empty results
 *                  array. Renders the search card and the no-results
 *                  card.
 *   - `failed`   : the search has Failed, OR the polling loop gave up
 *                  after two consecutive 5xx/network errors, OR the
 *                  initial POST got a non-validation, non-busy error.
 *                  Renders the search card and the failed alert.
 *   - `busy409`  : POST returned 409 talent_search_busy. Renders the
 *                  search card (NOT disabled) and the busy notice.
 *                  The Search button stays enabled so the user can
 *                  retry if the running search belongs to another tab.
 *
 * POST validation errors (too_short / too_long) are surfaced inside
 * the SearchBox as inline messages via the `inlineMessageFromPost`
 * state — set when the backend rejects a query the client thought was
 * valid (e.g. a paste with whitespace the trim didn't catch).
 *
 * Polling:
 *   - On submit: POST returns `{ searchId }`. The page transitions to
 *     `busy` and starts the polling loop (one immediate tick + 4000 ms
 *     intervals) until status is Completed or Failed.
 *   - Two consecutive network / 5xx errors transition the page to
 *     `failed`. A 404 also transitions to `failed`.
 *   - Polling stops on unmount and when a new submit happens.
 *
 * Focus:
 *   - When results arrive, the results header moves focus there so
 *     keyboard / screen-reader users land on the list instead of the
 *     (now stale) search button.
 */
type SearchStatus =
  | { kind: "idle" }
  | { kind: "busy"; searchId: string }
  | { kind: "busy409" }
  | { kind: "results"; searchId: string; results: TalentSearchResultItem[] }
  | { kind: "noResults"; searchId: string }
  | { kind: "failed"; lastQuery: string };

const EXAMPLE_PROMPTS = [
  "Data dashboards in Power BI",
  "Junior backend developer who knows .NET",
  "Designer with brand identity work",
];

const POLL_INTERVAL_MS = 4000;
const MAX_CONSECUTIVE_GET_ERRORS = 2;

export default function EmployerSearchPage() {
  return <EmployerSearchShell />;
}

function EmployerSearchShell() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>({ kind: "idle" });
  // Inline message shown under the textarea when the backend rejects
  // a query the client thought was valid (rare but possible — e.g.
  // a paste with hidden Unicode whitespace that survives trim).
  const [inlineMessageFromPost, setInlineMessageFromPost] = useState<
    string | null
  >(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------
  const handleSubmit = useCallback(async () => {
    if (!accessToken) return;
    const trimmed = query.trim();
    // Local validation: the SearchBox button is already disabled in
    // these states, but double-check here in case Enter was pressed
    // inside the textarea via Cmd/Ctrl+Enter.
    if (trimmed.length < 10 || trimmed.length > 1000) return;

    setInlineMessageFromPost(null);
    setStatus({ kind: "busy", searchId: "" });
    try {
      const { searchId } = await createTalentSearch(accessToken, {
        query: trimmed,
      });
      setStatus({ kind: "busy", searchId });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.errorCode === "talent_search_busy") {
          setStatus({ kind: "busy409" });
          return;
        }
        // Validation errors: surface inline in the SearchBox (the
        // spec asks for the same "Write at least 10 characters." /
        // "Use 1000 characters or fewer." copy on POST too).
        const inline = messageForTalentSearchError(error.errorCode);
        if (
          inline &&
          (error.errorCode === "talent_search_query_required" ||
            error.errorCode === "talent_search_query_too_short" ||
            error.errorCode === "talent_search_query_too_long")
        ) {
          setInlineMessageFromPost(inline);
          setStatus({ kind: "idle" });
          return;
        }
      }
      setStatus({ kind: "failed", lastQuery: trimmed });
    }
  }, [accessToken, query]);

  // ------------------------------------------------------------------
  // Polling loop — fires for any active `busy` state.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (status.kind !== "busy" || status.searchId.length === 0 || !accessToken) {
      return;
    }
    const searchId = status.searchId;
    let cancelled = false;
    let consecutiveErrors = 0;
    let currentController: AbortController | null = null;

    const tick = async () => {
      if (cancelled) return;
      currentController = new AbortController();
      try {
        const detail: TalentSearch = await getTalentSearch(
          accessToken,
          searchId,
          currentController.signal,
        );
        if (cancelled) return;
        consecutiveErrors = 0;
        if (detail.status === "Pending") return;
        if (detail.status === "Completed") {
          const results = detail.results ?? [];
          if (results.length === 0) {
            setStatus({ kind: "noResults", searchId });
          } else {
            setStatus({ kind: "results", searchId, results });
          }
          return;
        }
        // Failed.
        setStatus({ kind: "failed", lastQuery: query });
      } catch (error) {
        if (cancelled) return;
        // A 404 means the search was never this Organization's (or
        // was deleted); treat as failed immediately.
        if (error instanceof ApiError && error.status === 404) {
          setStatus({ kind: "failed", lastQuery: query });
          return;
        }
        consecutiveErrors += 1;
        if (consecutiveErrors >= MAX_CONSECUTIVE_GET_ERRORS) {
          setStatus({ kind: "failed", lastQuery: query });
        }
      }
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (currentController) currentController.abort();
    };
  }, [status, accessToken, query]);

  // ------------------------------------------------------------------
  // Focus the results heading when results arrive.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (status.kind === "results" || status.kind === "noResults") {
      resultsHeadingRef.current?.focus();
    }
  }, [status.kind]);

  // ------------------------------------------------------------------
  // Retry from failed state — re-submits the same query.
  // ------------------------------------------------------------------
  const handleRetry = useCallback(async () => {
    if (status.kind !== "failed" || !accessToken) return;
    const trimmed = status.lastQuery.trim();
    setQuery(trimmed);
    setInlineMessageFromPost(null);
    setStatus({ kind: "busy", searchId: "" });
    try {
      const { searchId } = await createTalentSearch(accessToken, {
        query: trimmed,
      });
      setStatus({ kind: "busy", searchId });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.errorCode === "talent_search_busy") {
          setStatus({ kind: "busy409" });
          return;
        }
      }
      setStatus({ kind: "failed", lastQuery: trimmed });
    }
  }, [status, accessToken]);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-8">
        <header>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Find students
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Describe who you need in your own words.
          </p>
        </header>

        <SearchBox
          value={query}
          onChange={(next) => {
            setQuery(next);
            // Clear the post-validation message the moment the user
            // types again, same UX as Phase 3's field-level errors.
            if (inlineMessageFromPost) setInlineMessageFromPost(null);
          }}
          onSubmit={handleSubmit}
          searching={status.kind === "busy"}
          inlineErrorMessage={inlineMessageFromPost}
        />

        {status.kind === "busy409" && (
          <div
            role="status"
            className="rounded-xl border bg-secondary px-4 py-3 text-sm text-foreground"
            style={{ borderColor: "var(--border)" }}
          >
            {messageForTalentSearchError("talent_search_busy")}
          </div>
        )}

        {status.kind === "idle" && query.trim().length === 0 && (
          <ExampleChips
            prompts={EXAMPLE_PROMPTS}
            onSelect={(prompt) => setQuery(prompt)}
          />
        )}

        {status.kind === "busy" && <SearchingState />}

        {(status.kind === "results" || status.kind === "noResults") && (
          <>
            <div className="flex items-baseline justify-between">
              <h2
                ref={resultsHeadingRef}
                tabIndex={-1}
                className="font-heading text-xl font-semibold text-foreground focus:outline-none"
              >
                Best matches
              </h2>
              {status.kind === "results" && (
                <p className="text-xs font-medium text-muted-foreground">
                  {resultsCountLine(status.results.length)}
                </p>
              )}
            </div>
            <p className="sr-only" role="status" aria-live="polite">
              {srResultsAnnouncement(
                status.kind === "results" ? status.results.length : 0,
              )}
            </p>
            {status.kind === "noResults" ? (
              <NoResultsState />
            ) : (
              <ol className="flex flex-col gap-5" data-testid="results-list">
                {status.results.map((result) => (
                  <ResultCard key={result.candidateId} result={result} />
                ))}
              </ol>
            )}
          </>
        )}

        {status.kind === "failed" && (
          <SearchFailedAlert onRetry={handleRetry} />
        )}
      </div>
    </div>
  );
}
