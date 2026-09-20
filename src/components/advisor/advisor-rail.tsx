"use client";

import { useState } from "react";
import {
  ChevronRight,
  Check,
  Columns2,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import {
  createComparison,
  MAX_EXPLORATIONS_PER_STUDENT,
  type ExplorationListItem,
} from "@/lib/api/growth";
import { railMeta } from "@/lib/growth/rail-meta";

import { StatusPillForStatus } from "@/components/advisor/status-pill";

interface AdvisorRailProps {
  items: ExplorationListItem[];
  selectedId: string | null;
  /** Called when the user picks a different exploration. */
  onSelect: (id: string) => void;
  /** Called when the user wants to start a brand new exploration. The
   *  rail disables this button automatically at the per-student cap. */
  onCreate: () => void;
  accessToken: string;
  /** Surfaces the comparison job the backend returns from
   *  `POST /compare` so the page can flip into the working/result flow. */
  onCompareRequest?: (detail: {
    comparisonId: string;
    firstId: string;
    secondId: string;
  }) => void;
  /** Called with the friendly error message so the page can render an
   *  inline alert under the rail's buttons. */
  onCompareError?: (message: string) => void;
  /** Whether a comparison is currently being created — used to disable
   *  the "Compare 2 selected" CTA while the request is in flight. */
  compareSubmitting?: boolean;
  creating?: boolean;
  /** Server told us the student is at the per-student cap — disables
   *  "New exploration" and surfaces the limit line under the buttons. */
  atLimit: boolean;
  /** Whether the comparison job is currently in flight. The page uses
   *  this to disable the entire rail so a user can't change their pick
   *  mid-request. */
  disabled?: boolean;
}

/**
 * STOR-40 Phase 5 — single combined rail + explorations list.
 *
 * Used at every breakpoint:
 *   - `lg+`  → the left grid column (272 px, plain aside, no card wrap).
 *   - `< lg` → the full-width list screen (after the phone heading block
 *              in the page) OR the in-list compare picker.
 *
 * Owns the local "compare mode" state (checkbox picker, "Compare 2 selected",
 * "Cancel"). The page keeps handling the actual comparison result.
 */
export function AdvisorRail({
  items,
  selectedId,
  onSelect,
  onCreate,
  accessToken,
  onCompareRequest,
  onCompareError,
  compareSubmitting = false,
  creating = false,
  atLimit,
  disabled = false,
}: AdvisorRailProps) {
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleRow(id: string) {
    if (disabled) return;
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return prev;
      return [...prev, id];
    });
  }

  async function handleConfirm() {
    if (selectedIds.length !== 2) return;
    const [firstId, secondId] = selectedIds;
    if (!firstId || !secondId || firstId === secondId) return;
    setSubmitting(true);
    try {
      const { comparisonId } = await createComparison(
        { firstExplorationId: firstId, secondExplorationId: secondId },
        accessToken,
      );
      onCompareRequest?.({ comparisonId, firstId, secondId });
      setCompareMode(false);
      setSelectedIds([]);
    } catch (error) {
      const message =
        error instanceof ApiError && error.errorCode === "exploration_has_no_summary"
          ? "Both explorations need a summary first."
          : error instanceof Error
            ? error.message
            : "Something went wrong. Try again.";
      onCompareError?.(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    setCompareMode(false);
    setSelectedIds([]);
  }

  function handleEnterCompare() {
    setCompareMode(true);
    setSelectedIds([]);
  }

  return (
    <aside
      aria-label="Explorations"
      className="flex flex-col gap-3"
    >
      {/* Header row: title + count / compare-mode hint */}
      <div className="flex items-baseline justify-between">
        <span className="font-heading text-[15px] font-semibold leading-tight text-foreground lg:hidden">
          Your explorations
        </span>
        <span className="hidden font-heading text-base font-semibold leading-tight text-foreground lg:inline">
          Explorations
        </span>
        {compareMode ? (
          <span className="hidden text-xs text-muted-foreground lg:inline">
            Pick two explorations.
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {items.length} of {MAX_EXPLORATIONS_PER_STUDENT}
          </span>
        )}
      </div>

      {/* Buttons: New exploration + Compare (or the compare-mode pair) */}
      <div className="flex flex-col gap-2">
        {compareMode ? (
          <>
            <Button
              onClick={handleConfirm}
              disabled={
                submitting || compareSubmitting || selectedIds.length !== 2
              }
              className="h-9 w-full justify-center rounded-[10px] px-3.5 text-sm font-semibold gap-2"
            >
              <Columns2 className="size-4" />
              Compare 2 selected
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              className="h-9 w-full justify-center rounded-[10px] px-3.5 text-sm font-semibold gap-2"
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={onCreate}
              disabled={creating || atLimit}
              className="h-9 w-full justify-center rounded-[10px] px-3.5 text-sm font-semibold gap-2"
            >
              <Plus className="size-4" />
              New exploration
            </Button>
            <Button
              variant="outline"
              onClick={handleEnterCompare}
              disabled={items.length < 2}
              className="h-9 w-full justify-center rounded-[10px] px-3.5 text-sm font-semibold gap-2"
            >
              <Columns2 className="size-4" />
              Compare
            </Button>
          </>
        )}
        {atLimit && !compareMode && (
          <p className="text-xs text-muted-foreground">
            You have {MAX_EXPLORATIONS_PER_STUDENT} explorations. Delete one to
            start another.
          </p>
        )}
      </div>

      {/* List */}
      <div className="mt-1 flex flex-col gap-2">
        {items.length === 0 ? (
          // Three skeleton rows so the rail keeps its rhythm while the
          // first-visit auto-create is in flight.
          <>
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </>
        ) : (
          items.map((item) => {
            const isSelected = item.id === selectedId;
            const isChecked = selectedIds.includes(item.id);
            const isDisabledCheckbox =
              compareMode && !isChecked && selectedIds.length >= 2;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (compareMode) {
                    if (!isDisabledCheckbox) toggleRow(item.id);
                    return;
                  }
                  if (!disabled) onSelect(item.id);
                }}
                aria-current={!compareMode && isSelected ? "true" : undefined}
                aria-pressed={compareMode ? isChecked : undefined}
                disabled={compareMode ? isDisabledCheckbox : disabled}
                className="flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors"
                style={
                  isSelected && !compareMode
                    ? { background: "#e7f0ed", borderColor: "#4d7ea0" }
                    : compareMode && isChecked
                      ? { background: "#e7f0ed", borderColor: "#4d7ea0" }
                      : { background: "var(--card)", borderColor: "var(--border)" }
                }
              >
                {compareMode && (
                  <span
                    aria-hidden
                    className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border"
                    style={
                      isChecked
                        ? {
                            background: "#4d7ea0",
                            borderColor: "#4d7ea0",
                          }
                        : {
                            background: "#ffffff",
                            borderColor: "#e7dfc0",
                          }
                    }
                  >
                    {isChecked && (
                      <Check
                        className="size-3 text-white"
                        strokeWidth={3}
                        aria-hidden
                      />
                    )}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="truncate font-heading text-sm font-semibold text-foreground">
                    {item.title || "Untitled exploration"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {railMeta(item)}
                  </span>
                </span>
                <RowTrailing
                  status={item.status}
                  showChevron={!compareMode}
                />
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

// --------------------------------------------------------------------
// Row helpers
// --------------------------------------------------------------------

function RowTrailing({
  status,
  showChevron,
}: {
  status: ExplorationListItem["status"];
  showChevron: boolean;
}) {
  // StatusPillForStatus returns `null` for the Idle state, so the row
  // still gets to render the chevron even when no pill is appropriate.
  const pill =
    status === "Working" || status === "Failed" ? (
      <StatusPillForStatus status={status} />
    ) : null;

  if (!pill && !showChevron) return null;

  return (
    <span className="flex shrink-0 items-center gap-2">
      {pill}
      {showChevron && (
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground lg:hidden"
          aria-hidden
        />
      )}
    </span>
  );
}

function RowSkeleton() {
  return (
    <div
      aria-hidden
      className="h-[58px] rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
    />
  );
}
