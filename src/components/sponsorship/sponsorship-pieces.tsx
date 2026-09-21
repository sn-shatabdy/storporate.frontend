import type { ReactNode } from "react";
import { Handshake, Wallet } from "lucide-react";

import type { GoalSetStatus } from "@/lib/api/sponsorship";

const PILL =
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold";

/** Active or Paused, in the same pill family as the job status pill. */
export function GoalStatusPill({ status }: { status: GoalSetStatus }) {
  const active = status === "Active";
  return (
    <span
      className={PILL}
      style={{
        backgroundColor: active ? "#e6f4ea" : "#fbeee7",
        color: active ? "#1e7b34" : "#a4460f",
      }}
    >
      {status}
    </span>
  );
}

/**
 * A row of read only chips. `tone` picks the look: objectives use the accent
 * tint, event kinds and other plain facts use the secondary tint. When `max`
 * is set, the rest collapse into a "+N more" chip.
 */
export function ChipList({
  items,
  label,
  tone = "accent",
  max,
  size = "md",
}: {
  items: string[];
  label: string;
  tone?: "accent" | "neutral";
  max?: number;
  size?: "sm" | "md";
}) {
  if (items.length === 0) return null;
  const shown = max === undefined ? items : items.slice(0, max);
  const rest = items.length - shown.length;
  const sizing =
    size === "sm"
      ? "px-[9px] py-[3px] text-[10.5px] sm:px-2.5 sm:text-[11px]"
      : "px-2.5 py-[3px] text-[11.5px]";
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label={label}>
      {shown.map((item) => (
        <li key={item}>
          <span
            className={`inline-flex items-center rounded-full font-semibold ${sizing} ${
              tone === "accent" ? "" : "bg-secondary text-foreground"
            }`}
            style={
              tone === "accent"
                ? { backgroundColor: "var(--accent)", color: "#345a73" }
                : undefined
            }
          >
            {item}
          </span>
        </li>
      ))}
      {rest > 0 ? (
        <li>
          <span
            className={`inline-flex items-center rounded-full bg-muted font-semibold text-muted-foreground ${sizing}`}
          >
            +{rest} more
          </span>
        </li>
      ) : null}
    </ul>
  );
}

/** The budget as a line with a small wallet icon. */
export function BudgetLine({
  children,
  muted,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <p
      className={`flex items-center gap-1.5 text-sm ${
        muted ? "text-muted-foreground" : "font-medium text-foreground"
      }`}
    >
      <Wallet className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Empty-state card for the sponsorship pages, same family as the club one. */
export function SponsorshipEmptyState({
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
        <Handshake className="size-5" aria-hidden />
      </span>
      <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      <p className="max-w-[360px] text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
