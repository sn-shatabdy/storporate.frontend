"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * STOR-40 Phase 5 — one shared "the advisor failed" card. Used in the
 * conversation column (when the most recent advisor turn failed) and in
 * the compare view (when the comparison job failed).
 *
 * Contract:
 *   - The card uses `role="alert"` and a fixed title + sub-line that
 *     NEVER surfaces the backend's `lastError` / `message` string (the
 *     backend can leak internal details).
 *   - The "Try again" button calls `onRetry`; the call site decides
 *     whether that means `retryExploration`, `createComparison`, or
 *     anything else.
 *   - The button uses an outline style (matching the workspace
 *     chrome) with a `RefreshCw` icon — explicitly NOT a `Loader2`
 *     so the button is never mistaken for an in-flight submit.
 */

interface FailedAlertProps {
  /** Invoked when the user clicks "Try again". */
  onRetry: () => void;
  /** Optional title override (kept simple — no backend message ever
   *  leaks into the card). */
  title?: string;
  /** Optional sub-line override. */
  message?: string;
}

export function FailedAlert({
  onRetry,
  title = "The advisor could not finish this",
  message = "Try again.",
}: FailedAlertProps) {
  return (
    <div
      role="alert"
      data-testid="failed-alert"
      className="flex items-start gap-3.5 rounded-[14px] border border-[rgba(179,38,30,0.25)] bg-[#fbe9e7] p-4"
    >
      <span
        aria-hidden
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-white text-[#b3261e]"
      >
        <AlertTriangle
          className="size-[18px]"
          strokeWidth={1.9}
          aria-hidden
        />
      </span>
      <div className="flex flex-col items-start gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-[15px] font-semibold leading-tight text-foreground">
            {title}
          </span>
          <span className="text-sm text-foreground">{message}</span>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-9 items-center justify-center rounded-[10px] border bg-white px-3.5 text-sm font-semibold gap-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
          style={{ borderColor: "#e7dfc0" }}
        >
          <RefreshCw className="size-4" aria-hidden />
          Try again
        </button>
      </div>
    </div>
  );
}