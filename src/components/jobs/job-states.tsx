import type { ReactNode } from "react";
import { Briefcase } from "lucide-react";

/** Empty-state card in the family used by the talent search surfaces. */
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
    <div
      role="status"
      className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-3.5 rounded-2xl border bg-card px-6 py-10 text-center shadow-sm sm:px-14 sm:py-12"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"
      >
        <Briefcase className="size-5" aria-hidden />
      </span>
      <h2 className="font-heading text-lg font-semibold text-foreground">
        {title}
      </h2>
      <p className="max-w-[360px] text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

/** Pulsing placeholder cards while a list loads. */
export function JobsListSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden
          className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <span className="block h-5 w-[55%] animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <span className="block h-3 w-[35%] animate-pulse rounded bg-muted motion-reduce:animate-none" />
          <div className="flex gap-2">
            <span className="block h-5 w-16 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            <span className="block h-5 w-20 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            <span className="block h-5 w-14 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
