"use client";

import { Loader2 } from "lucide-react";

/**
 * STOR-43 Phase 4 — the in-progress state shown below the search card
 * while the request is starting or while status is Pending.
 *
 * Composition:
 *   - A row with a spinner + the "Searching student portfolios." copy
 *     + the muted "This takes about a minute." sentence. Wrapped in
 *     `role="status"` so screen readers announce the change.
 *   - Two skeleton cards that visually match the result-card
 *     dimensions (avatar row, paragraph lines, skill-pill shapes on
 *     the first one only). Pure decoration, aria-hidden.
 *
 * No link / button to cancel — the design intentionally leaves the
 * search in flight until it resolves; the polling loop stops on
 * unmount and the busy backend state has its own timeout.
 */
export function SearchingState() {
  return (
    <div className="flex flex-col gap-3">
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2.5 text-sm text-foreground"
      >
        <Loader2
          className="size-4 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden
        />
        <span className="font-semibold">Searching student portfolios.</span>
        <span className="text-muted-foreground">This takes about a minute.</span>
      </div>

      <SkeletonCard withPills />
      <SkeletonCard withPills={false} />
    </div>
  );
}

function SkeletonCard({ withPills }: { withPills: boolean }) {
  return (
    <div
      aria-hidden
      className="flex animate-pulse flex-col gap-3.5 rounded-2xl border bg-card p-[22px] motion-reduce:animate-none"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3.5">
        <div className="size-11 shrink-0 rounded-[11px]" style={{ backgroundColor: "#f3efdd" }} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-3.5 w-[30%] rounded" style={{ backgroundColor: "#f3efdd" }} />
          <div className="h-2.5 w-[50%] rounded" style={{ backgroundColor: "#f3efdd" }} />
        </div>
      </div>
      <div className="h-2.5 w-full rounded" style={{ backgroundColor: "#f3efdd" }} />
      <div
        className={`h-2.5 rounded ${withPills ? "w-[82%]" : "w-[70%]"}`}
        style={{ backgroundColor: "#f3efdd" }}
      />
      {withPills && (
        <div className="flex gap-2">
          <div className="h-[22px] w-[110px] rounded-full" style={{ backgroundColor: "#f3efdd" }} />
          <div className="h-[22px] w-[90px] rounded-full" style={{ backgroundColor: "#f3efdd" }} />
        </div>
      )}
    </div>
  );
}
