"use client";

import Link from "next/link";
import { ArrowLeft, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * STOR-44 Phase 4 — the two candidate-level state components:
 *
 *   - `CandidateLoadingSkeleton`: two skeleton cards matching the
 *     candidate-header + first item card dimensions, in the same
 *     `bg-secondary` pulse the search page's `SearchingState` uses.
 *     A visually-hidden `role="status"` reads "Loading the student."
 *     so screen readers announce the change without skipping past
 *     the aria-hidden placeholders.
 *
 *   - `CandidateNotFound`: the centered "this student is no longer
 *     available" card for a 404 (the student turned off visibility
 *     between the search result and the drill-down click). Mirror
 *     shape of the `NoResultsState` card from the search page so
 *     the two empty surfaces feel like the same family.
 */

export function CandidateLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-7" role="status" aria-live="polite">
      <span className="sr-only">Loading the student.</span>
      <SkeletonHeader />
      <SkeletonItem />
    </div>
  );
}

function SkeletonHeader() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:p-6 motion-reduce:animate-none"
      style={{
        borderColor: "var(--border)",
        animation: "pulse 2s ease-in-out infinite",
      }}
    >
      <div className="flex items-center gap-4">
        <div
          className="size-14 shrink-0 rounded-[14px]"
          style={{ backgroundColor: "#f3efdd" }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div
            className="h-5 w-[40%] rounded"
            style={{ backgroundColor: "#f3efdd" }}
          />
          <div
            className="h-3 w-[55%] rounded"
            style={{ backgroundColor: "#f3efdd" }}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="h-3 w-[28%] rounded" style={{ backgroundColor: "#f3efdd" }} />
        <div className="h-3 w-[20%] rounded" style={{ backgroundColor: "#f3efdd" }} />
      </div>
    </div>
  );
}

function SkeletonItem() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-4 rounded-2xl border bg-card p-[22px] shadow-sm motion-reduce:animate-none"
      style={{
        borderColor: "var(--border)",
        animation: "pulse 2s ease-in-out infinite",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="size-9 shrink-0 rounded-[10px]"
          style={{ backgroundColor: "#f3efdd" }}
        />
        <div
          className="h-4 w-[55%] rounded"
          style={{ backgroundColor: "#f3efdd" }}
        />
      </div>
      <div className="flex gap-2">
        <div
          className="h-5 w-[110px] rounded-full"
          style={{ backgroundColor: "#f3efdd" }}
        />
        <div
          className="h-5 w-[90px] rounded-full"
          style={{ backgroundColor: "#f3efdd" }}
        />
      </div>
      <div className="h-3 w-full rounded" style={{ backgroundColor: "#f3efdd" }} />
      <div className="h-3 w-[70%] rounded" style={{ backgroundColor: "#f3efdd" }} />
    </div>
  );
}

export function CandidateNotFound() {
  return (
    <div
      className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-3.5 rounded-2xl border bg-card px-6 py-12 text-center shadow-sm sm:px-14"
      style={{ borderColor: "var(--border)" }}
      role="status"
    >
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"
      >
        <UserX className="size-5" aria-hidden />
      </span>
      <h3 className="font-heading text-lg font-semibold text-foreground">
        This student is no longer available.
      </h3>
      <p className="max-w-[360px] text-sm text-muted-foreground">
        They have turned off employer visibility.
      </p>
      <Link
        href="/employer/search"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Back to results
      </Link>
    </div>
  );
}

/**
 * Generic "could not load this student" card (the page-level error
 * for non-404 fetch failures: network down, 5xx, permission denied,
 * etc). Same centered shape as `AdvisorErrorState` so all three
 * guarded surfaces (search, advisor, candidate) present consistent
 * error transitions.
 */
export function CandidateLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-3.5 rounded-2xl border bg-card px-6 py-12 text-center shadow-sm sm:px-14"
      style={{ borderColor: "var(--border)" }}
      role="alert"
    >
      <h3 className="font-heading text-lg font-semibold text-foreground">
        Could not load this student
      </h3>
      <p className="max-w-[360px] text-sm text-muted-foreground">
        Check your connection and try again.
      </p>
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}
