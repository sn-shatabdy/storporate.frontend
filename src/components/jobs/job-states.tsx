import type { ReactNode } from "react";
import { AlertTriangle, Briefcase, Loader2, Search } from "lucide-react";

import { cn } from "cn";

/**
 * STOR-66 Phase 2 — empty and error states shared by the employer
 * openings list and the applicants view. STOR-66 Phase 3 adds the
 * matching student-side variants (the same shell, the same icon tile
 * shape, the same CTA styling) so both lists speak the same visual
 * language without copy-pasting markup.
 *
 * Empty-state variants:
 *   - `JobsEmptyState` — generic; used by the applicants page.
 *   - `EmployerNoOpenings` — no openings at all ("No openings yet" + CTA).
 *   - `EmployerNoMatch` — filter or search yielded nothing ("Clear filters").
 *   - `OpeningsEmptyState` — student side, no postings at all.
 *   - `OpeningsNoMatch` — student side, filter or search yielded nothing.
 *
 * Error variant: `JobsErrorState` — wraps the same shell with a danger
 * icon and the "Try again" CTA. `OpeningsErrorState` is the student
 * counterpart used inside the openings list and as the page-level error.
 *
 * The shell is exported as `EmployerStateCard` so callers can pass
 * their own icon + CTA when the design diverges.
 */

export function EmployerStateCard({
  icon,
  iconClassName,
  title,
  message,
  action,
  role = "status",
}: {
  icon: ReactNode;
  iconClassName?: string;
  title: string;
  message: string;
  action?: ReactNode;
  role?: "status" | "alert";
}) {
  return (
    <div
      role={role}
      className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-10 text-center shadow-sm"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-14 items-center justify-center rounded-full",
          iconClassName ?? "bg-secondary text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <h2 className="font-heading text-[20px] font-semibold leading-tight text-foreground">
        {title}
      </h2>
      <p className="max-w-[360px] text-[15px] leading-[1.5] text-muted-foreground">
        {message}
      </p>
      {action ? <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Generic empty state card (kept for backward compatibility with the
 *  applicant list and the student list). */
export function JobsEmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <EmployerStateCard
      icon={<Briefcase className="size-6" strokeWidth={1.8} aria-hidden />}
      iconClassName="bg-secondary text-muted-foreground"
      title={title}
      message={message}
      action={action}
    />
  );
}

/** Employer openings list: nothing posted yet. CTA is required. */
export function EmployerNoOpenings({
  action,
}: {
  action: ReactNode;
}) {
  return (
    <EmployerStateCard
      icon={<Briefcase className="size-6" strokeWidth={1.8} aria-hidden />}
      iconClassName="bg-secondary text-primary"
      title="No openings yet"
      message="Post your first job or internship. Students who fit will be able to apply."
      action={action}
    />
  );
}

/** Employer openings list: filter or search returned no rows. */
export function EmployerNoMatch({
  message,
  onClearFilters,
}: {
  message: string;
  onClearFilters: () => void;
}) {
  return (
    <EmployerStateCard
      icon={<Search className="size-6" strokeWidth={1.8} aria-hidden />}
      iconClassName="bg-secondary text-primary"
      title="No openings match"
      message={message}
      action={
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-border bg-background px-4 text-[15px] font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          Clear filters
        </button>
      }
    />
  );
}

/** Employer openings list: page-level load error. */
export function JobsErrorState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <EmployerStateCard
      role="alert"
      icon={<AlertTriangle className="size-6" strokeWidth={1.8} aria-hidden />}
      iconClassName="bg-danger-soft text-danger"
      title={title}
      message={message}
      action={
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-primary bg-background px-4 text-[15px] font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          Try again
        </button>
      }
    />
  );
}

/** Pulsing placeholder cards while a list loads. Mirrors the loading
 *  skeleton from the approved design canvas. */
export function JobsListSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden
          className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex gap-2">
            <span className="block h-[22px] w-[70px] animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
            <span className="block h-[22px] w-[52px] animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          </div>
          <span className="block h-[22px] w-[75%] animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          <span className="block h-[14px] w-[90%] animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          <div className="flex gap-2">
            <span className="block h-[26px] w-[64px] animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
            <span className="block h-[26px] w-[54px] animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
            <span className="block h-[26px] w-[72px] animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          </div>
          <span className="block h-px w-full bg-border" />
          <div className="flex gap-2.5">
            <span className="block h-[44px] w-[150px] animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
            <span className="block h-[44px] w-[70px] animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Phase 3 — student openings list, no postings at all. Mirrors the
 * employer "No openings yet" shape but uses the student-side copy from
 * the approved design canvas ("New jobs and internships appear here.
 * Check back soon."). No CTA — the student has nothing actionable to
 * take when there are no openings.
 */
export function OpeningsEmptyState() {
  return (
    <EmployerStateCard
      icon={<Briefcase className="size-6" strokeWidth={1.8} aria-hidden />}
      iconClassName="bg-secondary text-primary"
      title="No openings yet"
      message="New jobs and internships appear here. Check back soon."
    />
  );
}

/**
 * Phase 3 — student openings list, filter or search yielded nothing.
 * One CTA: "Clear all filters" (bordered, 46 px tall, primary text) wired
 * to `onClearFilters`.
 */
export function OpeningsNoMatch({ onClearFilters }: { onClearFilters: () => void }) {
  return (
    <EmployerStateCard
      icon={<Search className="size-6" strokeWidth={1.8} aria-hidden />}
      iconClassName="bg-secondary text-primary"
      title="No openings match"
      message="Try removing a filter or searching another word."
      action={
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[10px] border border-border bg-background px-4 text-[15px] font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          Clear all filters
        </button>
      }
    />
  );
}

/**
 * Phase 3 — student openings list, page-level load error. The CTA is the
 * outlined "Try again" button styled in the primary colour, matching the
 * approved design canvas (bordered, primary text, 46 px tall).
 */
export function OpeningsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <EmployerStateCard
      role="alert"
      icon={<AlertTriangle className="size-6" strokeWidth={1.8} aria-hidden />}
      iconClassName="bg-danger-soft text-danger"
      title="Could not load openings"
      message="Check your connection and try again."
      action={
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-[46px] items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-primary bg-background px-4 text-[15px] font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          Try again
        </button>
      }
    />
  );
}

/**
 * Phase 3 — inline pill that announces a background refetch (e.g. after
 * clearing a filter) to assistive tech without dimming the list. Pinned
 * above the cards so screen readers announce "Updating results" each
 * time the filter chip is removed.
 */
export function OpeningsRefetchIndicator() {
  return (
    <p
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 self-start rounded-full border bg-card px-3.5 py-2.5 text-[14px] font-bold text-muted-foreground"
      style={{ borderColor: "var(--border)" }}
    >
      <Loader2
        className="size-4 animate-spin text-primary motion-reduce:animate-none"
        aria-hidden
      />
      Updating results
    </p>
  );
}
