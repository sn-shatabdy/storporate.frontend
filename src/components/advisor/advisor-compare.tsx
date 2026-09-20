"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";

import type {
  ComparisonDetail,
  ExplorationListItem,
} from "@/lib/api/growth";
import { splitParagraphs } from "@/lib/growth/parse-message";

import { FailedAlert } from "@/components/advisor/failed-alert";
import { StatusPill } from "@/components/advisor/status-pill";

/** Wire shape for the page-level compare state. The page owns it.
 *
 *   - `working`  → the polling loop in this component is running.
 *   - `result`   → the backend returned a Completed comparison.
 *   - `error`    → the backend returned Failed (or the network threw).
 *
 *  CompareState never holds a `selecting` value here: the rail owns
 *  selection and the page only flips into one of the three states
 *  above once the rail's "Compare 2 selected" creates the job.
 */
export type CompareState =
  | { status: "working"; comparisonId: string; firstId: string; secondId: string }
  | {
      status: "result";
      comparisonId: string;
      firstId: string;
      secondId: string;
      resultText: string;
    }
  | { status: "error"; firstId: string; secondId: string };

interface AdvisorCompareProps {
  compareState: CompareState;
  list: ExplorationListItem[];
  accessToken: string;
  /** Called when the user clicks "Back to explorations" so the page can
   *  flip back into the list + workspace state. */
  onCancel: () => void;
  /** Called when the user clicks "Try again" on the comparison failure
   *  alert. The page re-fires `POST /compare` and lands us back in the
   *  working state with a fresh comparisonId. */
  onRetry: () => void;
  /** Called with the next state when the comparison job resolves (result
   *  or failed) so the page can update its canonical state. */
  onCompareStateChange: (next: CompareState) => void;
}

/**
 * STOR-40 Phase 5 — compare result screen.
 *
 * Mounts only when the comparison is in flight, has resolved, or has
 * failed. Owns its own polling ref so re-renders from the page don't
 * tear down the in-flight `setInterval` mid-fetch.
 *
 * Layout:
 *   1. Back link
 *   2. Heading block (h1 + two title chips + "and" connector)
 *   3. Working / Result / Failed card
 */
export function AdvisorCompare({
  compareState,
  list,
  accessToken,
  onCancel,
  onRetry,
  onCompareStateChange,
}: AdvisorCompareProps) {
  const firstTitle =
    list.find((item) => item.id === compareState.firstId)?.title ??
    compareState.firstId;
  const secondTitle =
    list.find((item) => item.id === compareState.secondId)?.title ??
    compareState.secondId;

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-5">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Back to explorations
        </button>

        <div className="flex flex-col gap-2.5 lg:gap-3">
          <h1 className="font-heading text-[22px] font-semibold leading-tight text-foreground lg:text-2xl">
            Comparison
          </h1>
          <div className="flex flex-col items-start gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <StatusPill variant="chip">{firstTitle}</StatusPill>
            <span className="hidden lg:inline text-[13px] text-muted-foreground">
              and
            </span>
            <StatusPill variant="chip">{secondTitle}</StatusPill>
          </div>
        </div>

        {compareState.status === "working" && <CompareWorking />}

        {compareState.status === "result" && (
          <CompareResult resultText={compareState.resultText} />
        )}

        {compareState.status === "error" && (
          <FailedAlert onRetry={onRetry} />
        )}

        {compareState.status === "working" && (
          <ComparePoller
            comparisonId={compareState.comparisonId}
            accessToken={accessToken}
            onResolved={(detail) => {
              if (detail.status === "Completed" && detail.resultText) {
                onCompareStateChange({
                  status: "result",
                  comparisonId: detail.id,
                  firstId: compareState.firstId,
                  secondId: compareState.secondId,
                  resultText: detail.resultText,
                });
              } else if (detail.status === "Failed") {
                onCompareStateChange({
                  status: "error",
                  firstId: compareState.firstId,
                  secondId: compareState.secondId,
                });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Sub-components
// --------------------------------------------------------------------

function CompareWorking() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-[#e7dfc0] bg-white p-[18px] lg:p-6"
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2.5">
          <StatusPill variant="working" />
          <span className="text-[13px] text-muted-foreground">
            This takes about a minute.
          </span>
        </div>
        <div className="h-3 w-full rounded-md bg-[#f3efdd] animate-pulse motion-reduce:animate-none" />
        <div className="h-3 w-[96%] rounded-md bg-[#f3efdd] animate-pulse motion-reduce:animate-none" />
        <div className="h-3 w-[88%] rounded-md bg-[#f3efdd] animate-pulse motion-reduce:animate-none" />
        <div className="h-3 w-full rounded-md bg-[#f3efdd] animate-pulse motion-reduce:animate-none" />
        <div className="h-3 w-[52%] rounded-md bg-[#f3efdd] animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function CompareResult({ resultText }: { resultText: string }) {
  const paragraphs = splitParagraphs(resultText);
  return (
    <div className="rounded-2xl border border-[#e7dfc0] bg-white p-[18px] lg:p-6">
      <div className="flex flex-col gap-3.5">
        {paragraphs.length === 0 ? (
          <p className="m-0 text-sm leading-[1.65] text-foreground whitespace-pre-line">
            {resultText}
          </p>
        ) : (
          paragraphs.map((para, i) => (
            <p
              key={i}
              className="text-sm leading-[1.65] text-foreground whitespace-pre-line"
            >
              {para}
            </p>
          ))
        )}
      </div>
    </div>
  );
}

/** Polling helper. Single immediate tick + 4 s interval, with a per-
 *  fetch AbortController so the next tick tears down the previous
 *  in-flight request. Latest-callback ref so re-renders from the parent
 *  don't tear down the interval. */
function ComparePoller({
  comparisonId,
  accessToken,
  onResolved,
}: {
  comparisonId: string;
  accessToken: string;
  onResolved: (detail: ComparisonDetail) => void;
}) {
  const onResolvedRef = useRef(onResolved);

  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);

  useEffect(() => {
    let cancelled = false;
    let currentController: AbortController | null = null;

    const tick = async () => {
      if (cancelled) return;
      currentController = new AbortController();
      try {
        const { getComparison } = await import("@/lib/api/growth");
        const detail = await getComparison(
          comparisonId,
          accessToken,
          currentController.signal,
        );
        if (cancelled) return;
        if (detail.status === "Pending") return;
        onResolvedRef.current(detail);
      } catch {
        // Swallow transient errors; the next tick will retry.
      }
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (currentController) currentController.abort();
    };
  }, [comparisonId, accessToken]);

  return null;
}

/** Strongly-typed access to a comparison's wire status. The polling
 * helper above narrows on these values; re-exporting the enum keeps
 * any future call site from drifting. */
export type { ComparisonDetail };