"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "cn";

/**
 * STOR-66 Phase 2 — a small accessible dialog primitive, hand-rolled so the
 * project does not pull in a new dependency for the employer "Close this
 * opening?" modal. The contract is:
 *
 *   - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` points at the
 *     title element.
 *   - Focus moves into the dialog on open (defaults to the first focusable
 *     child or the dialog container itself).
 *   - Tab / Shift+Tab cycles inside the dialog only (focus trap).
 *   - Escape closes the dialog.
 *   - On close, focus returns to the element that opened the dialog (the
 *     trigger passed in via `onClose`).
 *
 * The component is controlled: pass `open` and `onOpenChange`. The portal
 * target is `document.body` and only mounts when `open` is true.
 */
export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Optional short copy shown next to the title. */
  description?: ReactNode;
  children: ReactNode;
  /** Footer (buttons etc). Rendered after `children` inside the dialog. */
  footer?: ReactNode;
  /** Class name for the dialog panel. */
  panelClassName?: string;
  /** Optional id used by `aria-labelledby`. Defaults to a generated one. */
  titleId?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  panelClassName,
  titleId,
}: DialogProps) {
  const generatedId = useId();
  const labelId = titleId ?? `dialog-title-${generatedId}`;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  // Remember the trigger element on open and restore focus on close.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    return () => {
      // Restore focus after the panel unmounts.
      const target = returnFocusRef.current;
      if (target && typeof target.focus === "function") {
        target.focus();
      }
    };
  }, [open]);

  // Lock body scroll while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Move focus inside the dialog after it mounts.
  useEffect(() => {
    if (!open) return;
    const id = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const first = focusables[0] ?? panel;
      first.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  // Trap Tab inside the dialog and close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
      );
      if (focusables.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !panel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const portalTarget = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.body;
  }, []);

  if (!open || !portalTarget) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(42,24,48,0.5)] p-0 sm:items-center sm:p-6"
      onMouseDown={(event) => {
        // Click outside the panel closes the dialog.
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
        className={cn(
          "relative flex w-full max-w-[480px] flex-col gap-4 rounded-t-2xl border bg-card p-6 shadow-[0_24px_64px_rgba(42,24,48,0.3)] focus:outline-none sm:rounded-[18px]",
          panelClassName,
        )}
      >
        <button
          type="button"
          aria-label="Close dialog"
          onClick={close}
          className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <X className="size-4" aria-hidden />
        </button>
        <h2
          id={labelId}
          className="pr-9 font-heading text-[22px] font-semibold leading-tight text-foreground"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-sm leading-[1.55] text-muted-foreground">{description}</p>
        ) : null}
        <div className="flex flex-col gap-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 pt-2">{footer}</div>
        ) : null}
      </div>
    </div>,
    portalTarget,
  );
}
