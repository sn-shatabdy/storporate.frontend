import type {
  ExplorationDetail,
  ExplorationListItem,
} from "@/lib/api/growth";

/** Wire-shape defaults for the advisor surface fixtures used by the
 * page-level Vitest suite in `advisor-page.test.tsx`. Mirrors the same
 * discipline the portfolio suite uses (`test-helpers.ts`) so the wire
 * contract is enforced in one place and a future rename surfaces as a
 * single TS compile error rather than a sprawl of inline literals. */

const DEFAULT_TITLE = "Systems programming";
const DEFAULT_CREATED_AT = "2026-09-10T00:00:00Z";
/** Picked so the list-row relative-time label reads "Updated 1 h ago"
 * against the suite's frozen clock (`NOW` in `advisor-page.test.tsx`,
 * which is 1 hour after this timestamp). The page calls
 * `formatUpdated` without a `now` parameter, so the test suite freezes
 * `Date` with `vi.setSystemTime` to make the relative-time assertions
 * deterministic across runs. */
const DEFAULT_UPDATED_AT = "2026-09-19T15:00:00Z";

/** Builds an {@link ExplorationListItem} fixture. Tests override `id` and
 * `status` to drive the per-row pill colors. */
export function makeExplorationListItem(
  overrides: Partial<ExplorationListItem> = {},
): ExplorationListItem {
  return {
    id: "expl-001",
    title: DEFAULT_TITLE,
    status: "Idle",
    updatedAt: DEFAULT_UPDATED_AT,
    latestVersionNumber: 1,
    ...overrides,
  };
}

/** Builds a fully-formed {@link ExplorationDetail} fixture. The default
 * has no messages (the "first visit" reading-portfolio placeholder) and
 * no latest summary (the "No summary yet" empty state); tests override
 * `messages` and `latestSummary` to drive the conversation + summary
 * columns. */
export function makeExplorationDetail(
  overrides: Partial<ExplorationDetail> = {},
): ExplorationDetail {
  return {
    id: "expl-001",
    title: DEFAULT_TITLE,
    status: "Idle",
    lastError: null,
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_UPDATED_AT,
    messages: [],
    latestSummary: null,
    ...overrides,
  };
}
