import { styleForConfidenceBand } from "@/lib/portfolio/analysis-status";
import type {
  FitLabel,
  PostingKind,
  PostingStatus,
  WorkMode,
} from "@/lib/api/jobPostings";

/** Shared small pieces for job and internship surfaces. */

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  OnSite: "On site",
  Remote: "Remote",
  Hybrid: "Hybrid",
};

/** "On site · Dhaka" style meta text, location omitted when empty. */
export function workModeAndLocation(
  workMode: WorkMode,
  location: string | null,
): string {
  const parts = [WORK_MODE_LABELS[workMode] ?? workMode];
  if (location && location.trim()) parts.push(location.trim());
  return parts.join(" · ");
}

export function formatPostedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

const PILL =
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold";

export function KindPill({ kind }: { kind: PostingKind }) {
  return (
    <span
      className={PILL}
      style={{ backgroundColor: "#e8eef2", color: "#345a73" }}
    >
      {kind}
    </span>
  );
}

const STATUS_STYLES: Record<PostingStatus, { bg: string; fg: string }> = {
  Open: { bg: "#e6f4ea", fg: "#1e7b34" },
  Paused: { bg: "#fbeee7", fg: "#a4460f" },
  Closed: { bg: "#f3efdd", fg: "#6e6488" },
};

export function StatusPill({ status }: { status: PostingStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.Closed;
  return (
    <span className={PILL} style={{ backgroundColor: s.bg, color: s.fg }}>
      {status}
    </span>
  );
}

const FIT_STYLES: Record<FitLabel, { bg: string; fg: string }> = {
  "Strong match": { bg: "#e6f4ea", fg: "#1e7b34" },
  "Good match": { bg: "#e7f0ed", fg: "#345a73" },
  "Early match": { bg: "#fbeee7", fg: "#a4460f" },
  "Not yet": { bg: "#f3efdd", fg: "#6e6488" },
};

export function FitPill({ label }: { label: FitLabel }) {
  const s = FIT_STYLES[label] ?? FIT_STYLES["Not yet"];
  return (
    <span className={PILL} style={{ backgroundColor: s.bg, color: s.fg }}>
      {label}
    </span>
  );
}

/** Just the band word (Strong or Developing), for skill rows. */
export function BandPill({ band }: { band: string }) {
  const p = styleForConfidenceBand(band);
  return (
    <span className={PILL} style={{ backgroundColor: p.background, color: p.color }}>
      {p.label}
    </span>
  );
}

/** Plain skill chip. */
export function SkillChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded-full bg-secondary px-2.5 py-[3px] text-[11.5px] font-medium text-foreground"
    >
      {children}
    </span>
  );
}

/** "A, B, C +2 more" with at most `limit` names shown. */
export function truncatedList(names: string[], limit = 3): string {
  const shown = names.slice(0, limit).join(", ");
  const rest = names.length - limit;
  return rest > 0 ? `${shown} +${rest} more` : shown;
}
