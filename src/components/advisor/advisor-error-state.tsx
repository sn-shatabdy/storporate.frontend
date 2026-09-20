"use client";

import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

interface AdvisorErrorStateProps {
  /** Headline shown above the body sentence. Approved canvas uses
   * "Could not load your explorations" for the page-level error and
   * "Could not load this exploration" for the detail-level error. */
  title: string;
  /** Body sentence explaining what went wrong (or a generic fallback
   * when the backend didn't provide one). The page-level error card
   * passes the pinned "Check your connection and try again." copy;
   * the detail error passes the backend's message verbatim. */
  message: string;
  /** Called when the user clicks the "Try again" button. The page uses
   * this to bump the list / detail effect's dependency version so the
   * fetch re-runs. */
  onRetry: () => void;
}

/**
 * STOR-40 Phase 5 — centered error card with a destructive-tone icon,
 * title, body sentence, and a single "Try again" button.
 *
 * Used in two places:
 *
 *   1. The advisor page's top-level list error (replaces the page).
 *   2. The detail panel's per-exploration error (replaces the detail
 *      card while the list still renders above it).
 *
 * The shape mirrors the approved `Phone-10-Error` / `Desktop-09-Error`
 * canvases: rounded white card with the destructive-tone triangle tile,
 * Space Grotesk title, muted body sentence, and a primary blue
 * "Try again" button with a refresh icon.
 */
export function AdvisorErrorState({
  title,
  message,
  onRetry,
}: AdvisorErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border border-[#e7dfc0] bg-white px-5 py-10 text-center lg:gap-3.5 lg:px-6 lg:py-14"
    >
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-[#fbe9e7] text-[#b3261e] lg:size-[52px]"
      >
        <AlertTriangle
          className="size-[22px] lg:size-6"
          strokeWidth={1.8}
          aria-hidden
        />
      </span>
      <h2 className="font-heading text-[17px] font-semibold text-foreground lg:text-lg">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button onClick={onRetry} className="h-9">
        <RefreshCw className="size-4" />
        Try again
      </Button>
    </div>
  );
}

/** Centered card variant with a Sparkles accent icon — used for the
 *  "No explorations yet" empty state. Same shell as the error card
 *  but in the working-blue accent palette so it reads as positive
 *  call-to-action, not failure. */
export function AdvisorEmptyState({
  title,
  message,
  primaryLabel,
  onPrimary,
  primaryIcon: PrimaryIcon,
}: {
  title: string;
  message: string;
  primaryLabel: string;
  onPrimary: () => void;
  /** Lucide component for the primary CTA icon (e.g. `Plus`). */
  primaryIcon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-2xl border border-[#e7dfc0] bg-white px-5 py-10 text-center lg:gap-3.5 lg:px-6 lg:py-14"
    >
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-[#e7f0ed] text-[#4d7ea0] lg:size-[52px]"
      >
        <Sparkles
          className="size-[22px] lg:size-6"
          strokeWidth={1.8}
          aria-hidden
        />
      </span>
      <h2 className="font-heading text-[17px] font-semibold text-foreground lg:text-lg">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button onClick={onPrimary} className="h-9">
        <PrimaryIcon className="size-4" />
        {primaryLabel}
      </Button>
    </div>
  );
}