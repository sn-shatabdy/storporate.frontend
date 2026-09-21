import type { ReactNode } from "react";
import { AlertTriangle, Briefcase, Search } from "lucide-react";

import { cn } from "cn";

/**
 * STOR-66 Phase 2 — empty and error states shared by the employer
 * openings list and the applicants view. The shell mirrors the approved
 * design canvas (centred white card with a coloured icon tile, a
 * Space Grotesk heading, a muted body sentence and an optional CTA).
 *
 * Empty-state variants:
 *   - `JobsEmptyState` — generic; used by the applicants page.
 *   - `EmployerNoOpenings` — no openings at all ("No openings yet" + CTA).
 *   - `EmployerNoMatch` — filter or search yielded nothing ("Clear filters").
 *
 * Error variant: `JobsErrorState` — wraps the same shell with a danger
 * icon and the "Try again" CTA. The phase 2 plan keeps the more compact
 * `AdvisorErrorState` for the page-level error and uses the new shell
 * only inside the openings list. The shell is exported as
 * `EmployerStateCard` so callers can pass their own icon + CTA when
 * the design diverges.
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
