/**
 * Date/time formatters used by the advisor surface. The page renders three
 * different "time" labels per exploration:
 *
 * - "Updated 2 h ago" on the list row (relative, short)
 * - "Started 12 Sep" on the detail header (absolute short date, no year)
 * - "Summary version 2 · 14 Sep 2026" on the version badge
 *
 * Three separate helpers (rather than one with mode flags) so the call
 * sites read as English — `formatUpdated(iso)`, `formatStarted(iso)`,
 * `formatSummaryTime(iso)` — and so each can be pinned by tests against
 * the exact string the approved design canvas shows.
 */

/** Static month abbreviations — using `toLocaleDateString` here would
 * leak the test-host's locale (en-US produces "Sep 12, 2026", en-GB
 * produces "12 Sept 2026"), so we format the date ourselves and pin the
 * output to the canonical short form "12 Sep 2026" used everywhere. */
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/**
 * "2 h ago" / "3 days ago" / "12 Sep" — the list-row "Updated" label.
 *
 * Buckets:
 *   < 1 min   → "just now"
 *   < 60 min  → "{n} min ago" (singular: "1 min ago")
 *   < 24 h    → "{n} h ago"  (singular: "1 h ago")
 *   < 7 days  → "{n} days ago"
 *   else      → short date "12 Sep" (with year if not the current year)
 *
 * Falls back to the empty string if the ISO is unparseable (the row stays
 * tidy rather than rendering "Invalid Date").
 */
export function formatUpdated(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const diffMs = then.getTime() - now.getTime();
  if (!Number.isFinite(diffMs)) return "";

  const absDiffMs = Math.abs(diffMs);
  if (absDiffMs < 60 * 1000) return "just now";

  const minutes = Math.floor(absDiffMs / (60 * 1000));
  if (minutes < 60) {
    return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? "1 h ago" : `${hours} h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }

  return formatShortDate(then, now);
}

/**
 * "Started 12 Sep" — the detail header's created-at line. Always drops
 * the year when the date is in the current calendar year (the approved
 * design shows just the day + month); otherwise shows the full
 * "12 Sep 2025" form so old explorations stay unambiguous.
 */
export function formatStarted(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return `Started ${iso}`;
  const date = formatShortDate(then, now);
  return `Started ${date}`;
}

/**
 * "20 Sep, 09:14" — the summary version's created-at label. The wire
 * ISO is UTC, but the UI renders it in the VIEWER's local timezone so a
 * Dhaka student sees their own clock (a UTC pinning here would show
 * the summary six hours early). The locale is pinned to en-GB so the
 * 24-hour "HH:mm" form stays canonical regardless of the host locale.
 */
export function formatSummaryTime(
  iso: string,
  now: Date = new Date(),
): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;
  const date = formatShortDate(then, now);
  const time = then.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}

/** Shared "12 Sep" / "12 Sep 2025" formatter used by both `formatUpdated`
 * (when the date falls outside the 7-day window) and `formatStarted`. */
function formatShortDate(then: Date, now: Date): string {
  const sameYear = then.getFullYear() === now.getFullYear();
  const month = SHORT_MONTHS[then.getMonth()];
  const day = then.getDate();
  return sameYear ? `${day} ${month}` : `${day} ${month} ${then.getFullYear()}`;
}
