import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  type LucideIcon,
} from "lucide-react";

import type {
  ExplorationStatus,
  GapBand,
} from "@/lib/api/growth";

/**
 * Single source of truth for the advisor surface's pill styling.
 * Mirrors the same source-of-truth-and-test discipline used by
 * `src/lib/portfolio/analysis-status.ts`:
 *   - Background / foreground hex pairs are pinned by a test (see
 *     `status-style.test.tsx`) so an accidental tweak fails the suite.
 *   - Colors are inline-styled (not Tailwind palette classes) so the
 *     exact hex pairs don't have to map to this app's design tokens.
 *   - The spin animation is applied at the call site, not stored here,
 *     so the same map entry is reusable in static contexts (legend rows,
 *     dashboard card, etc.) that don't want a spinning icon.
 *
 * The entries cover every visible "pill" on the advisor surface: the
 * list-row status, the detail header status, the "working" pill on the
 * messages thread while a turn is in flight, the summary's "version N"
 * chip, the gap-band chips, and the compare title chip. The Failed pill
 * carries the destructive tone that already ships as `--destructive`
 * (`#b3261e`) in globals.css, but is recorded here verbatim per the
 * canvas.
 */

export type WorkingTone = "Working" | "Idle" | "Failed";
export type VersionTone = "Latest" | "Older";

/**
 * Pairs each exploration wire status with the pill style shown in the
 * list row, the detail header, and the dashboard card.
 *
 * - `Working` → spinning "Working…" with the working blue tone
 *   (`#e8eef2` / `#345a73`). Spin class is applied at the call site.
 * - `Idle` → check-marked "Up to date" with the green success tone
 *   (`#e6f4ea` / `#1e7b34`). Same hex pair the portfolio `Analyzed`
 *   pill uses (kept here verbatim per the approved canvas).
 * - `Failed` → warning "Failed" with the destructive red tone
 *   (`#fbe9e7` / `#b3261e`). Same hex pair the portfolio `Failed` pill
 *   uses.
 */
export const EXPLORATION_STATUS_STYLES: Record<
  ExplorationStatus,
  { background: string; color: string; label: string; icon: LucideIcon }
> = {
  Working: {
    background: "#e8eef2",
    color: "#345a73",
    label: "Working…",
    icon: CircleDot,
  },
  Idle: {
    background: "#e6f4ea",
    color: "#1e7b34",
    label: "Up to date",
    icon: CheckCircle2,
  },
  Failed: {
    background: "#fbe9e7",
    color: "#b3261e",
    label: "Failed",
    icon: AlertTriangle,
  },
};

/** Defensive lookup — mirrors the pattern `styleForAnalysisStatus` uses.
 * Returns the `Idle` entry's style when the wire value isn't one of the
 * known statuses, so a future backend status still renders a readable
 * pill rather than crashing the row. */
export function styleForExplorationStatus(status: string): {
  background: string;
  color: string;
  label: string;
  icon: LucideIcon;
} {
  return (
    EXPLORATION_STATUS_STYLES[status as ExplorationStatus] ??
    EXPLORATION_STATUS_STYLES.Idle
  );
}

/**
 * Version-badge styling (the "Summary version N" chip on the detail
 * header and on the summary card). Two tones:
 *
 * - `Latest` → solid white background with the primary border + text
 *   color so the latest version reads as the "active" version.
 * - `Older` → muted background + muted-foreground text so older
 *   versions visibly recede behind the latest one.
 */
export const VERSION_BADGE_STYLES: Record<
  VersionTone,
  { background: string; color: string; label: string; icon: LucideIcon }
> = {
  Latest: {
    background: "#e7f0ed",
    color: "#345a73",
    label: "Latest",
    icon: CircleDot,
  },
  Older: {
    background: "#f3efdd",
    color: "#6e6488",
    label: "Older",
    icon: CircleDashed,
  },
};

export function styleForVersionBadge(tone: VersionTone): {
  background: string;
  color: string;
  label: string;
  icon: LucideIcon;
} {
  return VERSION_BADGE_STYLES[tone];
}

/**
 * Gap-band styling — the small "Developing" / "Missing" pill at the
 * right edge of a gap card in the summary panel.
 *
 * - `Developing` → warm-cream tone (`#fbeee7` / `#a4460f`).
 * - `Missing` → destructive tone (`#fbe9e7` / `#b3261e`), matching the
 *   Failed pill so a Missing gap visually pairs with the failure state.
 */
export const CONFIDENCE_BAND_STYLES: Record<
  GapBand,
  { background: string; color: string; label: string }
> = {
  Developing: {
    background: "#fbeee7",
    color: "#a4460f",
    label: "Developing",
  },
  Missing: {
    background: "#fbe9e7",
    color: "#b3261e",
    label: "Missing",
  },
};

/** Lookup for the gap-band chip. Returns the `Developing` entry when an
 * unknown band comes through, so the summary still renders a pill rather
 * than collapsing the row. */
export function styleForConfidenceBand(band: string): {
  background: string;
  color: string;
  label: string;
} {
  return (
    CONFIDENCE_BAND_STYLES[band as GapBand] ??
    CONFIDENCE_BAND_STYLES.Developing
  );
}

/**
 * Title-chip styling — the small rounded chip that sits next to the
 * "Comparison" heading, naming one of the two explorations being
 * compared. Mirrors the working-blue tone the title-row pill uses so the
 * chips feel like the same family of pill.
 */
export const TITLE_CHIP_STYLE: {
  background: string;
  color: string;
} = {
  background: "#e7f0ed",
  color: "#345a73",
};

/** Returns the lone title-chip style. Takes no argument now (the prior
 * "Topic"/"Neutral" two-tone split was removed; comparison titles always
 * use the working-blue chip). Kept as a function so the `StatusPill`'s
 * `chip` variant has a single named source. */
export function styleForTitleChip(): {
  background: string;
  color: string;
} {
  return TITLE_CHIP_STYLE;
}
