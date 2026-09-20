import type { ExplorationListItem } from "@/lib/api/growth";
import { formatUpdated } from "./format-time";

/**
 * Per-row meta line shown under the exploration title in the rail.
 *
 *   - `Failed`                   → "Failed"
 *   - `Working` + no summary     → "Preparing"
 *   - `Working` + with a summary → "Working"
 *   - `Idle` + no summary        → "Waiting for your answers"
 *   - `Idle` + with a summary    → "Updated {relative}"
 *
 * "No summary" means `latestVersionNumber == null` — the wire shape
 * carries `null` when no summary has been written yet, and may carry
 * `undefined` in older fixtures or test mocks; the loose equality covers
 * both. Mirrors the spec in `docs/plans/stor-40-design/`: the rail row
 * shows ONE short meta line, never a version pill or "No summary yet"
 * placeholder.
 */
export function railMeta(item: ExplorationListItem, now: Date = new Date()): string {
  const hasSummary = item.latestVersionNumber != null;
  if (item.status === "Failed") {
    return "Failed";
  }
  if (item.status === "Working") {
    return hasSummary ? "Working" : "Preparing";
  }
  // Idle: only show the relative timestamp once a summary exists; the
  // no-summary state reads as "Waiting for your answers" so the rail
  // doesn't show a misleading "Updated just now" the moment an
  // exploration is created.
  if (!hasSummary) {
    return "Waiting for your answers";
  }
  return `Updated ${formatUpdated(item.updatedAt, now)}`.trim();
}
