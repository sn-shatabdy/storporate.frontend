import { daysBetween, todayIsoDate } from "./posting-helpers";

/**
 * STOR-66 Phase 2 — short, human deadline copy on the employer openings
 * list cards. STOR-66 Phase 3 also uses the same helper for the student
 * openings list and detail. The wording maps to the four states shown on
 * the design canvas:
 *
 *   - "Closes in 3 days"        (still in the future, 1..14 days away)
 *   - "Closes today"            (deadline is today)
 *   - "Closes 15 Oct"           (further in the future, > 14 days)
 *   - "Closed 2 Sep"            (deadline already passed)
 *   - null                       (no deadline set)
 *
 * The numbers use the visitor's local clock so the wording matches the
 * date picker on the form. `closingSoon` is the narrower flag Phase 3
 * needs for the "Closing soon" warning tone on student cards (≤ 3 days
 * remaining), so callers do not have to recompute the day diff themselves.
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

/** ≤ this many days remaining (incl. today) trips the student-side
 *  "Closing soon" warning tone. Phase 3 spec, not user-configurable. */
export const CLOSING_SOON_DAYS = 3;

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

/**
 * Phase 3 — true when the deadline is at most `CLOSING_SOON_DAYS` away
 * (including "today"), false when the deadline is more than that far in
 * the future, and false when the posting has no deadline. Past deadlines
 * are reported as "Expired" elsewhere (the posting is filtered out of
 * browse for non-applicants), so this helper only flags "still open and
 * closing soon".
 */
export function isClosingSoon(
  iso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!iso) return false;
  const diff = daysBetween(todayIsoDate(now), iso);
  if (diff === null) return false;
  return diff >= 0 && diff <= CLOSING_SOON_DAYS;
}