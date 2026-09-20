import type { ExplorationListItem } from "@/lib/api/growth";
import { formatUpdated } from "./format-time";

/**
 * Per-row meta line shown under the exploration title in the rail.
 *
 *   - `Working` → "Preparing" for the opening turn (no summary yet) and
 *     "Waiting for your answers" once a summary exists and a follow-up
 *     turn is in flight.
 *   - `Failed`  → "Failed".
 *   - `Idle`    → "Updated {relative}" using {@link formatUpdated}.
 *
 * Mirrors the spec in `docs/plans/stor-40-design/`: the rail row shows
 * ONE short meta line, never a version pill or "No summary yet" placeholder.
 */
export function railMeta(item: ExplorationListItem, now: Date = new Date()): string {
  if (item.status === "Failed") {
    return "Failed";
  }
  if (item.status === "Working") {
    return item.latestVersionNumber === null ? "Preparing" : "Waiting for your answers";
  }
  return `Updated ${formatUpdated(item.updatedAt, now)}`.trim();
}
