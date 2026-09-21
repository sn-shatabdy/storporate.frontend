"use client";

import { cn } from "cn";

/**
 * STOR-43 Phase 4 — the colored skill+band pill used in result cards.
 * Two sizes:
 *   - `card` is the larger pill in the matched-skills row of a card
 *     (matches the design spec's "rounded-full px-2.5 py-1 text-[11px]
 *     font-semibold").
 *   - `inline` is the smaller pill next to a cited portfolio item
 *     (uses the agreed `px-[9px] py-[3px]` category-pill size).
 *
 * STOR-66 Phase 2 — colors come from the success/warning/danger token
 * classes so they match the rest of the job surface. Bands outside
 * Strong / Developing fall through to the danger palette — the
 * backend only ever emits those two on results, but the defensive
 * mapping keeps the page robust if that ever changes.
 *
 * Text format is the agreed "{name} · {band}" with the middle dot —
 * same joiner used everywhere else in the app for meta joins.
 */
export type SkillBandPillSize = "card" | "inline";

export interface SkillBandPillProps {
  name: string;
  band: string;
  size?: SkillBandPillSize;
}

const BAND_TONE_CLASS: Record<string, string> = {
  Strong: "bg-success-soft text-success",
  Developing: "bg-warning-soft text-warning",
  Missing: "bg-danger-soft text-danger",
};

export function SkillBandPill({
  name,
  band,
  size = "card",
}: SkillBandPillProps) {
  const tone = BAND_TONE_CLASS[band] ?? BAND_TONE_CLASS.Missing;
  const sizeClasses =
    size === "card"
      ? "rounded-full px-2.5 py-1 text-[11px] font-semibold"
      : "rounded-full px-[9px] py-[3px] text-[11px] font-semibold";
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap",
        sizeClasses,
        tone,
      )}
    >
      {name} · {band}
    </span>
  );
}
