"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "cn";

/**
 * STOR-66 Phase 2 — a small accessible disclosure menu primitive. The
 * trigger is a real button with `aria-haspopup="menu"` and `aria-expanded`;
 * the panel uses `role="menu"` with `role="menuitem"` children. Keyboard
 * support: Enter / Space opens the menu (and activates the focused item
 * when already open), ArrowDown / ArrowUp cycle items (wrapping), Escape
 * closes and returns focus to the trigger, click outside closes.
 *
 * No external dependency — hand-rolled to keep the repo dependencies
 * exactly as they are.
 */

export interface MenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Tone for the row: destructive rows are coloured with the danger
   *  semantic token. */
  tone?: "default" | "destructive";
  disabled?: boolean;
  /** Optional separator rendered before this item. */
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface MenuProps {
  /** Visible label on the trigger button. */
  triggerLabel: string;
  /** Optional icon node, rendered before the label. */
  triggerIcon?: ReactNode;
  /** Items inside the menu (in render order). */
  items: MenuItem[];
  /** Class for the trigger button. Defaults to the neutral outline button
   *  used on the employer openings list. */
  triggerClassName?: string;
  /** Class for the popover panel. */
  panelClassName?: string;
  /** When true, the menu is disabled and ignored. */
  disabled?: boolean;
  /** Extra props forwarded to the trigger button (e.g. `aria-label`). */
  triggerProps?: Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "type" | "onClick" | "disabled" | "className" | "children"
  >;
}

export function Menu({
  triggerLabel,
  triggerIcon,
  items,
  triggerClassName,
  panelClassName,
  disabled,
  triggerProps,
}: MenuProps) {
  const generatedId = useId();
  const menuId = `${generatedId}-menu`;
  // Single source of truth for open-ness and the currently focused item.
  // `focusIndex` is `null` while closed; opening always focuses item 0.
  const [state, setState] = useState<{
    open: boolean;
    focusIndex: number | null;
  }>({ open: false, focusIndex: null });
  const open = state.open;
  const focusIndex = state.focusIndex;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  function openMenu(nextFocus = 0) {
    setState({ open: true, focusIndex: nextFocus });
  }

  function closeMenu() {
    setState({ open: false, focusIndex: null });
  }

  // Close on outside click — only subscribes while the menu is open.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      closeMenu();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const focusItem = useCallback(
    (next: number) => {
      const total = items.length;
      if (total === 0) return;
      const safe = ((next % total) + total) % total;
      setState((prev) => ({ ...prev, focusIndex: safe }));
      const id = `${menuId}-item-${items[safe].key}`;
      window.requestAnimationFrame(() => {
        const el = document.getElementById(id);
        el?.focus();
      });
    },
    [items, menuId],
  );

  // When the menu opens, focus the chosen item after mount (defer to next
  // macrotask so the panel has been added to the DOM).
  useEffect(() => {
    if (!open || focusIndex === null) return;
    const id = `${menuId}-item-${items[focusIndex]?.key ?? ""}`;
    const handle = window.setTimeout(() => {
      document.getElementById(id)?.focus();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [open, focusIndex, items, menuId]);

  function activate(index: number) {
    const item = items[index];
    if (!item || item.disabled) return;
    closeMenu();
    triggerRef.current?.focus();
    item.onSelect();
  }

  function onTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu(0);
    }
  }

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem((focusIndex ?? 0) + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem((focusIndex ?? items.length - 1) - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(items.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (focusIndex !== null) activate(focusIndex);
    } else if (event.key === "Tab") {
      // Tab outside the menu closes it (focus moves naturally).
      closeMenu();
    }
  }

  return (
    <div className="relative">
      <button
        {...triggerProps}
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => (open ? closeMenu() : openMenu(0))}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-border bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
        )}
      >
        {triggerIcon ?? null}
        <span className="sr-only">{triggerLabel}</span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={menuId}
          role="menu"
          aria-label={triggerLabel}
          onKeyDown={onMenuKeyDown}
          className={cn(
            "absolute right-0 bottom-[52px] z-10 w-[220px] rounded-[12px] border border-border bg-card p-1.5 shadow-[0_12px_32px_rgba(42,24,48,0.16)] focus:outline-none",
            panelClassName,
          )}
        >
          {items.map((item, index) => (
            <div key={item.key}>
              {item.separatorBefore ? (
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  className="my-1 h-px bg-border"
                />
              ) : null}
              <button
                id={`${menuId}-item-${item.key}`}
                type="button"
                role="menuitem"
                tabIndex={focusIndex === index ? 0 : -1}
                disabled={item.disabled}
                onClick={() => activate(index)}
                className={cn(
                  "flex h-11 w-full items-center gap-2.5 rounded-[8px] px-3.5 text-left text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                  item.tone === "destructive"
                    ? "text-danger hover:bg-danger-soft"
                    : "text-foreground hover:bg-muted",
                  item.disabled && "cursor-not-allowed opacity-60",
                )}
              >
                {item.icon ? (
                  <span aria-hidden className="flex items-center">
                    {item.icon}
                  </span>
                ) : null}
                {item.label}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
