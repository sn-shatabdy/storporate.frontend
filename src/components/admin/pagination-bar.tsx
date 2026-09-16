"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationBarProps {
  /** 1-based current page number, as returned by the backend's `PagedResult.pageNumber`. */
  pageNumber: number;
  /** Total number of pages (0 when the result set is empty). */
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPageChange: (nextPage: number) => void;
  /**
   * Human-readable "Showing X–Y of N entries" string pre-computed by the
   * parent (so the math around `totalCount`/`pageSize` lives in one place,
   * not here).
   */
  summaryLabel: string;
  disabled?: boolean;
}

/**
 * Builds the visible page-number list. Always shows pages `1` and the last
 * page so the user can jump to either end without paging linearly; "..."
 * ellipses appear when there's a gap of more than one page between adjacent
 * visible numbers. Keeps the row a single line on common desktop widths
 * without bringing in a full numeric-pagination library just for one
 * consumer.
 */
function visiblePageNumbers(pageNumber: number, totalPages: number): Array<number | "ellipsis"> {
  if (totalPages <= 1) return [];
  const pages = new Set<number>([1, totalPages, pageNumber, pageNumber - 1, pageNumber + 1]);
  for (const p of pages) {
    if (p < 1 || p > totalPages) continue;
  }
  // Build the ordered list with ellipses where the gap exceeds 1.
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev !== 0 && p - prev > 1) out.push("ellipsis");
    out.push(p);
    prev = p;
  }
  return out;
}

export function PaginationBar({
  pageNumber,
  totalPages,
  hasPrevious,
  hasNext,
  onPageChange,
  summaryLabel,
  disabled,
}: PaginationBarProps) {
  if (totalPages === 0) {
    // Hide the row entirely when there's nothing to page through — a zero-
    // entries table shouldn't show a misleading "Showing 1-20 of 0" footer.
    return null;
  }

  const pages = visiblePageNumbers(pageNumber, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-6 py-4 text-sm text-muted-foreground">
      <span className="font-normal">{summaryLabel}</span>
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(pageNumber - 1)}
          disabled={!hasPrevious || disabled}
          aria-label="Previous page"
          className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-4" />
        </button>
        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`ellipsis-${idx}`} aria-hidden className="px-2 text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              disabled={disabled}
              aria-current={p === pageNumber ? "page" : undefined}
              className={
                p === pageNumber
                  ? "inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-semibold bg-accent text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  : "inline-flex h-8 min-w-8 items-center justify-center rounded-md border bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              }
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(pageNumber + 1)}
          disabled={!hasNext || disabled}
          aria-label="Next page"
          className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
