"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmLoading?: boolean;
  /** Optional `loadingLabel` shown in place of `confirmLabel` while
   * `confirmLoading` is true. Default "Logging out…" preserves the
   * original logout-flow behavior; the advisor surface passes its own
   * text (e.g. "Deleting…") so the button still reads correctly when the
   * action isn't signing out. */
  loadingLabel?: string;
  /** Optional leading icon for the destructive confirm button. Rendered
   * before the label with the same size treatment the Button component
   * uses, so a trash icon alongside "Delete" reads as a single action.
   * Accepts any node (Lucide icons, etc.). */
  confirmIcon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A small, self-contained confirmation modal (title, one consequence
 * sentence, Cancel + destructive confirm) — hand-rolled rather than a
 * shadcn `AlertDialog`, which isn't installed in this project yet (only
 * `button.tsx`/`card.tsx` exist under `components/ui`). Traps focus loosely
 * (focuses the cancel button on open) and closes on Escape or backdrop click,
 * matching the plan's "gated behind a confirmation dialog" requirement.
 *
 * STOR-40 Phase 5 added the optional `confirmIcon` and `loadingLabel`
 * props so the advisor's "Delete this exploration?" dialog can render
 * with a trash icon and a "Deleting…" loading label, instead of the
 * default logout-specific copy + no-icon shape.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  confirmLoading,
  loadingLabel = "Logging out…",
  confirmIcon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border bg-[var(--auth-card-bg,white)] p-6 shadow-xl"
        style={{ borderColor: "var(--auth-border, #e5e5e5)" }}
      >
        <h2 id="confirm-dialog-title" className="font-heading-auth text-lg font-semibold" style={{ color: "var(--auth-text-primary,#111)" }}>
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mt-2 text-sm" style={{ color: "var(--auth-text-muted,#666)" }}>
          {description}
        </p>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-sm font-medium outline-none focus-visible:ring-4 focus-visible:ring-black/10"
            style={{ borderColor: "var(--auth-border, #e5e5e5)", color: "var(--auth-text-primary,#111)" }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmLoading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#B3261E] px-4 py-2 text-sm font-semibold text-white outline-none transition-opacity focus-visible:ring-4 focus-visible:ring-[#B3261E]/30 disabled:opacity-60"
          >
            {confirmLoading ? (
              loadingLabel
            ) : (
              <>
                {confirmIcon}
                {confirmLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
