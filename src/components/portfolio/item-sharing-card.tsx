"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Link2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api/errors";
import {
  updateItemSharing,
  type PortfolioItem,
} from "@/lib/api/portfolio";

/**
 * STOR-44 Phase 3 — "Employer access" card. Lets the signed-in student
 * decide, per portfolio item, whether an employer who finds them may open
 * the item's original file/link AND read the AI's written reason for each
 * skill rating (the latter is the new capability this phase ships).
 *
 * Three visible states:
 *   - Off      → switch off, "Off. Employers who find you see this item's
 *                title and skills only."
 *   - On       → switch on, "On. Employers who find you can open this
 *                file/link and read why each skill was rated.", plus a
 *                collapsible "Employers can see" panel listing the two
 *                things that become visible, and a "stays private" line.
 *   - Disabled → the student has not turned on employer visibility
 *                (`/dashboard/visibility`); the switch is locked off with
 *                a "Go to employer visibility" link.
 *
 * Save behaviour: optimistic. The switch flips locally, the
 * `updateItemSharing` PUT fires once with the new value, the switch is
 * locked while the request is in flight, and a `role="status"` line under
 * the card shows "Saving…" → "Saved." (cleared after 3s or on the next
 * toggle). On failure the switch reverts to the prior value and a
 * `role="alert"` line inside the middle block surfaces "Could not save.
 * Try again." — cleared on the next toggle.
 *
 * The component is intentionally controlled: the parent owns `item` and
 * is notified via `onChanged(updatedItem)` on success so the page state
 * (and the list-page pill) stay in sync without the card owning its own
 * cache of the response.
 */
export interface ItemSharingItem {
  id: string;
  submissionType: "File" | "Link";
  originalFileName: string | null;
  shareOriginalWithEmployers: boolean;
}

export interface ItemSharingCardProps {
  item: ItemSharingItem;
  isSearchable: boolean;
  /** The signed-in student's bearer token. The card is responsible only
   * for the PUT; the parent already handles 401/403 redirects at a higher
   * level. */
  accessToken: string;
  /** Called with the updated item from the server after a successful
   * PUT. The parent updates its own state so the list pill flips and the
   * next render of this card receives the fresh value. */
  onChanged: (updatedItem: PortfolioItem) => void;
}

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number };

export function ItemSharingCard({
  item,
  isSearchable,
  accessToken,
  onChanged,
}: ItemSharingCardProps) {
  // The displayed switch state. Always tracks the parent's `item` EXCEPT
  // mid-save (where it shows the user's intended value optimistically) and
  // during the brief moment between a failed save and the next render
  // (where it must revert to the prior persisted value).
  const [displayChecked, setDisplayChecked] = useState(
    item.shareOriginalWithEmployers,
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ref to the in-flight AbortController so a re-render or unmount can
  // cancel a pending PUT. We deliberately create a fresh one on every
  // toggle rather than reusing a stable one — the parent re-rendering
  // this card with a new `item` (e.g. after `onChanged`) is the signal
  // that the previous save is done.
  const inflightRef = useRef<AbortController | null>(null);

  // React 19 "adjusting state on prop change" pattern: when the parent
  // hands us a different persisted value, sync `displayChecked` to it
  // DURING RENDER (not in an effect — that trips the
  // `react-hooks/set-state-in-effect` lint). We track the previous
  // value as state so React knows when to retry the render; the
  // comparison gates on `saveStatus.kind !== "saving"` so an optimistic
  // flip survives until the PUT resolves (otherwise the parent re-
  // passing the old `item.shareOriginalWithEmployers` mid-save would
  // immediately revert the UI).
  const [lastSyncedItem, setLastSyncedItem] = useState({
    id: item.id,
    shareOriginal: item.shareOriginalWithEmployers,
  });
  if (
    (lastSyncedItem.id !== item.id ||
      lastSyncedItem.shareOriginal !== item.shareOriginalWithEmployers) &&
    saveStatus.kind !== "saving"
  ) {
    setLastSyncedItem({
      id: item.id,
      shareOriginal: item.shareOriginalWithEmployers,
    });
    setDisplayChecked(item.shareOriginalWithEmployers);
  }

  // Auto-clear the "Saved." line after 3s (per the spec) or whenever a new
  // toggle starts.
  useEffect(() => {
    if (saveStatus.kind !== "saved") return;
    const id = window.setTimeout(() => {
      setSaveStatus((current) =>
        current.kind === "saved" ? { kind: "idle" } : current,
      );
    }, 3000);
    return () => window.clearTimeout(id);
  }, [saveStatus]);

  // Cleanup any in-flight PUT on unmount so a navigated-away student
  // doesn't leak a pending request.
  useEffect(() => {
    return () => {
      inflightRef.current?.abort();
      inflightRef.current = null;
    };
  }, []);

  const disabled = !isSearchable;
  const isSaving = saveStatus.kind === "saving";
  const headingId = useId();

  // The status paragraph + (optionally) the inline error. Composed up
  // here so the JSX below doesn't repeat the conditional logic three
  // times for off / on / disabled.
  const statusCopy = (() => {
    if (disabled) {
      return "Turn on employer visibility to use this.";
    }
    if (displayChecked) {
      return item.submissionType === "File"
        ? "On. Employers who find you can open this file and read why each skill was rated."
        : "On. Employers who find you can open this link and read why each skill was rated.";
    }
    return "Off. Employers who find you see this item's title and skills only.";
  })();

  async function handleToggle(next: boolean) {
    // Reset per-toggle state.
    setErrorMessage(null);

    // If the new value matches what's already persisted (e.g. a rapid
    // double-click that landed on the same value) — short-circuit so we
    // don't issue a redundant PUT.
    if (next === item.shareOriginalWithEmployers && !isSaving) {
      return;
    }

    const previous = displayChecked;
    setDisplayChecked(next);
    setSaveStatus({ kind: "saving" });

    const controller = new AbortController();
    inflightRef.current?.abort();
    inflightRef.current = controller;

    try {
      const updated = await updateItemSharing(
        accessToken,
        item.id,
        next,
        controller.signal,
      );
      inflightRef.current = null;
      setSaveStatus({ kind: "saved", at: Date.now() });
      onChanged(updated);
    } catch (error) {
      inflightRef.current = null;
      // Revert the optimistic flip and surface a single short message.
      setDisplayChecked(previous);
      setSaveStatus({ kind: "idle" });
      if (error instanceof ApiError && error.status === 404) {
        setErrorMessage("This item no longer exists.");
      } else {
        setErrorMessage("Could not save. Try again.");
      }
    }
  }

  const Icon = item.submissionType === "File" ? FileText : Link2;
  const onPanelVisible = !disabled && displayChecked;

  return (
    <section
      aria-labelledby={headingId}
      className="bg-card border p-5 shadow-sm sm:p-6"
      style={{
        borderRadius: 20,
        borderColor: "var(--border)",
        boxShadow: "0 1px 2px rgba(42,24,48,0.06)",
      }}
    >
      <div className="flex items-center gap-5">
        <span
          aria-hidden
          className={
            disabled
              ? "flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground"
              : "flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"
          }
        >
          <Icon className="size-6" />
        </span>

        <div className="min-w-0 flex-1">
          <h2
            id={headingId}
            className="font-heading text-lg font-semibold text-foreground"
          >
            Employer access
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{statusCopy}</p>
          {disabled && (
            <Link
              href="/dashboard/visibility"
              className="mt-1.5 inline-block text-[13px] font-semibold text-primary hover:underline"
            >
              Go to employer visibility
            </Link>
          )}
          {errorMessage && (
            <p role="alert" className="mt-1.5 text-xs font-medium text-[#b3261e]">
              {errorMessage}
            </p>
          )}
        </div>

        <Switch
          checked={displayChecked}
          disabled={disabled || isSaving}
          onCheckedChange={handleToggle}
          aria-labelledby={headingId}
        />
      </div>

      {onPanelVisible && (
        <div className="mt-4 flex flex-col gap-4 border-t pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Employers can see
          </p>
          <ul className="list-disc pl-[18px] text-sm leading-[1.7]">
            <li className="break-words">
              {item.submissionType === "File"
                ? `The original file${item.originalFileName ? `, ${item.originalFileName}` : ""}`
                : "The original link"}
            </li>
            <li>The written reason for each skill rating</li>
          </ul>
          <p className="text-[13px] text-muted-foreground">
            Your description of this item stays private.
          </p>
        </div>
      )}

      {saveStatus.kind !== "idle" && (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-[13px] text-muted-foreground"
        >
          {saveStatus.kind === "saving" ? "Saving…" : "Saved."}
        </p>
      )}
    </section>
  );
}
