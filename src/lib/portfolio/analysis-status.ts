import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  type LucideIcon,
} from "lucide-react";

/**
 * Wire values for `PortfolioItem.analysisStatus` and each entry's
 * `confidenceBand`. Mirrors the backend's `AnalysisStatus` / `ConfidenceBand`
 * string enums 1:1 — any drift from the backend enum will surface here as a
 * TS compile error because the Records below are keyed by the literal union.
 */

export type AnalysisStatus =
  | "NotAnalyzed"
  | "Analyzing"
  | "Analyzed"
  | "Failed"
  | "Unsupported";

export type ConfidenceBand = "Strong" | "Developing" | "Missing";

/**
 * Single source of truth for the status badge's colors, label text, and
 * leading icon. Colors are inline-styled (not Tailwind palette classes) so
 * the exact hex pairs don't have to map to this app's design tokens — the
 * same approach the audit-log `ActionPill` uses for its severity buckets.
 *
 * The hex values and copy text below were approved pixel-for-pixel on the
 * design canvas; do NOT change them without re-sign-off. The map test in
 * `__tests__/analysis-status.test.tsx` pins every value so an accidental
 * future tweak fails the suite immediately.
 *
 * `Loader2` is stored without the `animate-spin` class — the spin class is
 * applied at render time so non-`Analyzing` call sites (e.g. a future status
 * legend) don't accidentally inherit a spinning icon.
 */
export const ANALYSIS_STATUS_STYLES: Record<
  AnalysisStatus,
  { background: string; color: string; label: string; icon: LucideIcon }
> = {
  NotAnalyzed: {
    background: "#f3efdd",
    color: "#6e6488",
    label: "Not analyzed",
    icon: Clock,
  },
  Analyzing: {
    background: "#e8eef2",
    color: "#345a73",
    label: "Analyzing…",
    icon: Loader2,
  },
  Analyzed: {
    background: "#e6f4ea",
    color: "#1e7b34",
    label: "Analyzed",
    icon: CheckCircle2,
  },
  Unsupported: {
    background: "#f3efdd",
    color: "#6e6488",
    label: "Not supported",
    icon: Ban,
  },
  Failed: {
    background: "#fbe9e7",
    color: "#b3261e",
    label: "Analysis failed",
    icon: AlertTriangle,
  },
};

/**
 * Defensive lookup: returns the `NotAnalyzed` entry's style if the wire value
 * isn't one of the known statuses (mirrors `severityForAction`'s
 * unknown-action fall-through). Lets the list row render a readable pill
 * rather than crashing if the backend ships a new status before this map is
 * updated.
 */
export function styleForAnalysisStatus(status: string): {
  background: string;
  color: string;
  label: string;
  icon: LucideIcon;
} {
  return (
    ANALYSIS_STATUS_STYLES[status as AnalysisStatus] ??
    ANALYSIS_STATUS_STYLES.NotAnalyzed
  );
}

/**
 * Per-confidence-band pill colors. No icon — these render as plain
 * colored-text pills on each skill card. Same source-of-truth-and-test
 * discipline as the status map above.
 */
export const CONFIDENCE_BAND_STYLES: Record<
  ConfidenceBand,
  { background: string; color: string; label: string }
> = {
  Strong: { background: "#e6f4ea", color: "#1e7b34", label: "Strong" },
  Developing: { background: "#fbeee7", color: "#a4460f", label: "Developing" },
  Missing: { background: "#fbe9e7", color: "#b3261e", label: "Missing" },
};

export function styleForConfidenceBand(band: string): {
  background: string;
  color: string;
  label: string;
} {
  return (
    CONFIDENCE_BAND_STYLES[band as ConfidenceBand] ??
    CONFIDENCE_BAND_STYLES.Missing
  );
}
