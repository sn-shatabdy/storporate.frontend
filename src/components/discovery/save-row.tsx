"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * STOR-43 Phase 3 — the Save row at the bottom of the visibility page.
 * The primary "Save changes" button uses the agreed primary blue
 * (`bg-primary` = #4d7ea0) with white text; while saving the label flips
 * to "Saving…" and the button shows a spinning Loader2 with
 * `motion-reduce:animate-none`. The status text next to the button uses
 * `role="status"` so screen readers announce it when it changes.
 */
export interface SaveRowProps {
  dirty: boolean;
  saving: boolean;
  savedOnce: boolean;
  formError: string | null;
  onSave: () => void;
}

export function SaveRow({
  dirty,
  saving,
  savedOnce,
  formError,
  onSave,
}: SaveRowProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="h-9 rounded-[10px] px-4 text-sm font-semibold"
          aria-label={saving ? "Saving" : "Save changes"}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
        <p
          role="status"
          aria-live="polite"
          className="text-[13px] text-muted-foreground"
        >
          {formError ? (
            <span role="alert" className="text-sm text-destructive">
              {formError}
            </span>
          ) : dirty ? (
            "You have unsaved changes."
          ) : savedOnce ? (
            "All changes saved."
          ) : null}
        </p>
      </div>
    </div>
  );
}
