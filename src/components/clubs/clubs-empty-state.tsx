import type { ReactNode } from "react";
import { Sparkles, Users } from "lucide-react";

/**
 * STOR-69 Phase 2 — empty-state card used by the club pages.
 *
 * Two flavors share the same shell so the empty state never looks out
 * of place on a club surface:
 *   - `tone="neutral"` (default): the long-standing employer-side empty
 *     state ("no clubs match", "this club profile is not available").
 *   - `tone="inviting"`: the first-visit empty state for a brand new
 *     club account. The icon flips to the warm Sparkles glyph and the
 *     accent tile picks up the working-blue token so the card reads as
 *     a positive call to action rather than a dead end.
 */
export function ClubsEmptyState({
  title,
  message,
  action,
  tone = "neutral",
}: {
  title: string;
  message: string;
  action?: ReactNode;
  tone?: "neutral" | "inviting";
}) {
  const inviting = tone === "inviting";
  return (
    <div
      role="status"
      className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-3.5 rounded-2xl border bg-card px-6 py-10 text-center shadow-sm sm:px-14 sm:py-12"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className={
          inviting
            ? "flex size-12 items-center justify-center rounded-full bg-accent text-primary"
            : "flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"
        }
      >
        {inviting ? (
          <Sparkles className="size-5" aria-hidden />
        ) : (
          <Users className="size-5" aria-hidden />
        )}
      </span>
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      <p className="max-w-[360px] text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
