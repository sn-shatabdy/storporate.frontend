import * as React from "react";
import { cn } from "cn";

/**
 * STOR-43 Phase 3 — accessible `<button role="switch">` primitive. Used by
 * the visibility page for the master "let employers find me" toggle and
 * each per-field show/hide switch; will be reused by the Phase 4 employer
 * search settings if needed.
 *
 * Implementation notes:
 *   - Renders a real `<button type="button" role="switch" aria-checked>` so
 *     keyboard activation (Space / Enter) and screen-reader semantics come
 *     for free — no extra click handling needed.
 *   - `checked` + `onCheckedChange` mirror the Radix Switch / Headless UI
 *     control contract; `disabled` blocks both pointer + keyboard toggles
 *     and applies the agreed reduced-opacity treatment.
 *   - `size` only switches the track + thumb dimensions; the colors, focus
 *     ring, transition, and disabled treatment are identical so a page
 *     mixing sizes reads as one control family.
 *   - `aria-label` / `aria-labelledby` pass through to the button so the
 *     call site is the single source of truth for the accessible name.
 *   - Respects `prefers-reduced-motion` via `motion-reduce:transition-none`.
 */
export type SwitchSize = "default" | "sm";

export interface SwitchProps
  extends Omit<React.ComponentProps<"button">, "onChange"> {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  size?: SwitchSize;
}

function Switch({
  className,
  checked,
  onCheckedChange,
  disabled,
  size = "default",
  ...props
}: SwitchProps) {
  // The native button toggles a boolean on click — we intercept that and
  // forward the opposite value to the caller. `type` is forced to "button"
  // because a switch inside a `<form>` must not submit the form when
  // activated with Space/Enter.
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onCheckedChange(!checked);
  };

  const isDefault = size === "default";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-slot="switch"
      data-size={size}
      onClick={handleClick}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        isDefault ? "h-[26px] w-[44px] p-[2px]" : "h-5 w-9 p-[2px]",
        className,
      )}
      style={{
        // Checked → primary blue; unchecked → muted border tan. Inline so
        // the exact approved hexes don't depend on Tailwind palette
        // mappings (same approach the status pills use).
        backgroundColor: checked ? "var(--primary)" : "var(--border)",
      }}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "block rounded-full bg-white shadow-[0_1px_2px_rgba(42,24,48,0.25)] transition-transform motion-reduce:transition-none",
          isDefault
            ? "size-[22px]"
            : "size-4",
        )}
        style={{
          // When checked, slide the thumb to the right; when unchecked,
          // leave it flush against the leading padding. Using transforms
          // (not left/right) keeps the animation GPU-accelerated and
          // honors the transition utility above.
          transform: isDefault
            ? `translateX(${checked ? 18 : 0}px)`
            : `translateX(${checked ? 16 : 0}px)`,
        }}
      />
    </button>
  );
}

export { Switch };
