import type { FitBand } from "@/lib/api/matching";

const PILL =
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold";

// Same colors as the job fit pills: Strong is green, Good is the primary tint,
// Partial is the warm tint.
const STYLES: Record<FitBand, { bg: string; fg: string }> = {
  Strong: { bg: "#e6f4ea", fg: "#1e7b34" },
  Good: { bg: "#e7f0ed", fg: "#345a73" },
  Partial: { bg: "#fbeee7", fg: "#a4460f" },
};

/** The fit as a word band, for example "Strong fit". Never a number. */
export function FitBadge({ fit }: { fit: FitBand }) {
  const s = STYLES[fit] ?? STYLES.Partial;
  return (
    <span className={PILL} style={{ backgroundColor: s.bg, color: s.fg }}>
      {fit} fit
    </span>
  );
}
