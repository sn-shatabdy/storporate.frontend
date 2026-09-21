import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Empty-state card for the shortlist and message surfaces. Same shell as
 *  the jobs empty state, with a choice of icon. */
export function OutreachEmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
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
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="font-heading text-lg font-semibold text-foreground">
        {title}
      </h2>
      {message ? (
        <p className="max-w-[360px] text-sm text-muted-foreground">{message}</p>
      ) : null}
      {action}
    </div>
  );
}
