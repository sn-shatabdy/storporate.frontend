"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * STOR-43 Phase 4 — variant of the advisor `FailedAlert` for the talent
 * search. The advisor component's `title` / `message` props already
 * support overrides, but the agreed copy for this surface ("The search
 * could not finish" / "Try again.") is different enough that a tiny
 * dedicated component reads cleaner than overloading the advisor one
 * — and it lets us move forward with a copy edit without touching the
 * advisor surface. Same hex palette and shape as `FailedAlert` so the
 * two error states feel like the same family.
 */
export interface SearchFailedAlertProps {
  onRetry: () => void;
}

export function SearchFailedAlert({ onRetry }: SearchFailedAlertProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3.5 rounded-[14px] border bg-[#fbe9e7] p-4"
      style={{ borderColor: "rgba(179,38,30,0.25)" }}
    >
      <span
        aria-hidden
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-white text-[#b3261e]"
      >
        <AlertTriangle className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="flex flex-col items-start gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-[15px] font-semibold leading-tight text-foreground">
            The search could not finish
          </span>
          <span className="text-sm text-foreground">Try again.</span>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border bg-white px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          style={{ borderColor: "#e7dfc0" }}
        >
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </button>
      </div>
    </div>
  );
}
