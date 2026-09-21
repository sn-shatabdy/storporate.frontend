import { Check, type LucideIcon } from "lucide-react";

import type {
  ApplicationStatus,
  FitLabel,
  PostingKind,
  PostingStatus,
  WorkMode,
} from "@/lib/api/jobPostings";

import { cn } from "cn";

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
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-bold";

/** "Job" or "Internship", info blue tokens. */
export function KindPill({ kind }: { kind: PostingKind }) {
  return <span className={cn(PILL, "bg-info-soft text-info")}>{kind}</span>;
}

export interface StatusPillProps {
  status: PostingStatus;
  /** Optional icon shown next to the label (e.g. Pause for Paused). */
  icon?: LucideIcon;
  /** Override tone — used for an Expired deadline chip on an Open posting. */
  tone?: "default" | "warning" | "danger" | "neutral";
  /** When `true`, render as an "Expired" tone override even on Open postings. */
  expired?: boolean;
  /** Optional label override; defaults to the posting status. */
  label?: string;
}

const STATUS_TONE: Record<PostingStatus, "default" | "warning" | "neutral"> = {
  Open: "default",
  Paused: "warning",
  Closed: "neutral",
};

const STATUS_TONE_CLASS: Record<
  "default" | "warning" | "danger" | "neutral",
  string
> = {
  default: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-secondary text-muted-foreground",
};

export function StatusPill({ status, icon: Icon, tone, expired, label }: StatusPillProps) {
  const resolved = expired ? "danger" : tone ?? STATUS_TONE[status];
  const text = expired ? "Expired" : (label ?? status);
  return (
    <span className={cn(PILL, "gap-1", STATUS_TONE_CLASS[resolved])}>
      {Icon ? <Icon className="size-3" strokeWidth={2.5} aria-hidden /> : null}
      {text}
    </span>
  );
}

const FIT_TONE: Record<FitLabel, "success" | "info" | "warning" | "neutral"> = {
  "Strong match": "success",
  "Good match": "info",
  "Early match": "warning",
  "Not yet": "neutral",
};

const FIT_TONE_CLASS = {
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  neutral: "bg-secondary text-muted-foreground",
} as const;

export function FitPill({ label }: { label: FitLabel }) {
  return (
    <span className={cn(PILL, FIT_TONE_CLASS[FIT_TONE[label]])}>{label}</span>
  );
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  Submitted: "Submitted",
  Viewed: "Viewed",
  Shortlisted: "Shortlisted",
  NotSelected: "Not selected",
};

const APPLICATION_TONE: Record<
  ApplicationStatus,
  "neutral" | "info" | "success" | "warning"
> = {
  Submitted: "neutral",
  Viewed: "info",
  Shortlisted: "success",
  NotSelected: "warning",
};

/** Where an application stands: Submitted, Viewed, Shortlisted, Not selected. */
export function ApplicationStatusPill({ status }: { status: ApplicationStatus }) {
  return (
    <span className={cn(PILL, FIT_TONE_CLASS[APPLICATION_TONE[status]])}>
      {APPLICATION_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** Small marker on an opening the student has already applied to. */
export function AppliedPill() {
  return (
    <span className={cn(PILL, "gap-1", FIT_TONE_CLASS.info)}>
      <Check className="size-3" strokeWidth={3} aria-hidden />
      Applied
    </span>
  );
}

/** Just the band word (Strong or Developing), for skill rows.
 *  Phase 2: uses the success/warning tokens (was `styleForConfidenceBand`,
 *  which produced inline hex). The band labels are normalised so callers
 *  can pass either "Strong" / "Developing" or "Strong" / "Developing". */
const BAND_TONE_CLASS: Record<string, string> = {
  Strong: "bg-success-soft text-success",
  Developing: "bg-warning-soft text-warning",
  Missing: "bg-secondary text-muted-foreground",
};
const BAND_LABEL: Record<string, string> = {
  Strong: "Strong",
  Developing: "Developing",
  Missing: "Missing",
};

export function BandPill({ band }: { band: string }) {
  const tone = BAND_TONE_CLASS[band] ?? BAND_TONE_CLASS.Missing;
  const label = BAND_LABEL[band] ?? band;
  return <span className={cn(PILL, tone)}>{label}</span>;
}

/** Plain skill chip — used by the openings list and the "How students will
 *  see it" preview card. */
export function SkillChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className={cn(
        PILL,
        "bg-secondary text-foreground",
        "px-[11px] py-[5px] text-[13px] font-semibold",
      )}
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

/** "BDT 15,000" with a thin space as the thousands separator. */
export function formatBdt(n: number): string {
  return `BDT ${n.toLocaleString("en-US")}`;
}

/** Render a pay range in whole taka per month. Hides the bound entirely
 *  when null. */
export function formatPayRange(
  min: number | null,
  max: number | null,
  unit = "per month",
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${formatBdt(min)} to ${formatBdt(max)} ${unit}`.trim();
  if (min != null) return `From ${formatBdt(min)} ${unit}`.trim();
  return `Up to ${formatBdt(max as number)} ${unit}`.trim();
}

/** Pluralise "opening" / "openings" based on count. */
export function formatOpenings(n: number | undefined | null): string {
  const v = n ?? 1;
  return `${v} ${v === 1 ? "opening" : "openings"}`;
}
