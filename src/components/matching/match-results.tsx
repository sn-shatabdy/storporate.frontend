import type { ReactNode } from "react";

import type { MatchFailure } from "./matching-helpers";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import { SponsorshipEmptyState } from "@/components/sponsorship/sponsorship-pieces";

import { MatchListSkeleton } from "./match-card-skeleton";

/**
 * The results area shared by both match pages: skeleton, error with retry,
 * two kinds of empty state, and the list. Pages handle the blocking failures
 * (missing goal set, missing or draft profile) before they render this.
 */
export function MatchResults<T>({
  items,
  failure,
  loading,
  query,
  onRetry,
  onClear,
  what,
  emptySuggestions,
  renderItem,
  getKey,
}: {
  items: T[] | null;
  failure: MatchFailure | null;
  loading: boolean;
  query: string;
  onRetry: () => void;
  onClear: () => void;
  /** Plural noun for labels, for example "clubs". */
  what: string;
  emptySuggestions: string;
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
}) {
  if (items === null) {
    if (failure) {
      return (
        <AdvisorErrorState
          title={`Could not load ${what}`}
          message="Check your connection and try again."
          onRetry={onRetry}
        />
      );
    }
    return <MatchListSkeleton label={`Loading ${what}.`} />;
  }

  const searching = query.length > 0;
  return (
    <>
      {failure === "generic" ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border bg-[#fbe9e7] p-4 text-sm text-foreground"
          style={{ borderColor: "rgba(179,38,30,0.25)" }}
        >
          <span>Could not update the list. Check your connection and try again.</span>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-9 bg-white"
            onClick={onRetry}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {items.length === 0 ? (
        <SponsorshipEmptyState
          title={searching ? `No ${what} match your words.` : "No suggestions yet."}
          message={
            searching
              ? "Try fewer or different words, or clear the search to see suggestions."
              : emptySuggestions
          }
          action={
            searching ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="mt-1 h-10 sm:h-9"
                onClick={onClear}
              >
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <section className="flex flex-col gap-3" aria-label={searching ? "Search results" : "Suggestions"}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {searching ? "Search results" : "Suggested for you"}
          </p>
          <ul className="flex flex-col gap-3" aria-busy={loading} aria-label={what}>
            {items.map((item) => (
              <li key={getKey(item)}>{renderItem(item)}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
