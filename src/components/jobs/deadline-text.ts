import { daysBetween, todayIsoDate } from "./posting-helpers";

/**
 * STOR-66 Phase 2 — short, human deadline copy on the employer openings
 * list cards. The wording maps to the four states shown on the design
 * canvas:
 *
 *   - "Closes in 3 days"        (still in the future)
 *   - "Closes today"            (deadline is today)
 *   - "Closes 15 Oct"           (further in the future)
 *   - "Closed 2 Sep"            (deadline already passed)
 *   - null                       (no deadline set)
 *
 * The numbers use the visitor's local clock so the wording matches the
 * date picker on the form.
 */
export type DeadlineText =
  | { kind: "today"; text: string }
  | { kind: "soon"; text: string }
  | { kind: "later"; text: string }
  | { kind: "past"; text: string }
  | { kind: "none" };

const SHORT_DATE_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
};

export function deadlineText(
  iso: string | null | undefined,
  now: Date = new Date(),
): DeadlineText {
  if (!iso) return { kind: "none" };
  const diff = daysBetween(todayIsoDate(now), iso);
  if (diff === null) return { kind: "none" };
  if (diff < 0) {
    const d = new Date(`${iso}T00:00:00Z`);
    return {
      kind: "past",
      text: `Closed ${Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", SHORT_DATE_FMT)}`,
    };
  }
  if (diff === 0) return { kind: "today", text: "Closes today" };
  if (diff > 0 && diff <= 14) {
    return { kind: "soon", text: `Closes in ${diff} day${diff === 1 ? "" : "s"}` };
  }
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    kind: "later",
    text: `Closes ${Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", SHORT_DATE_FMT)}`,
  };
}