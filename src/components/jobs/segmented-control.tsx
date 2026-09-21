"use client";

import { cn } from "cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * STOR-66 Phase 2 — segmented control built on native radio inputs, so
 * arrow keys, focus and screen reader semantics come for free. The
 * legend is now visible (was `sr-only` in STOR-66 Phase 1, which left
 * the segmented control with an aria-hidden label that did not match
 * the fieldset legend — Phase 2 fixes that mismatch).
 *
 * The visible segments render with the approved palette: unchecked
 * shows a neutral cream tile; checked fills with the primary blue.
 */
export function SegmentedControl<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  disabled,
  className,
  size = "md",
}: {
  name: string;
  legend: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  className?: string;
  /** Visual size of the segments. The form uses `lg` (46 px tall), the
   *  list filter uses `md` (40 px tall). */
  size?: "md" | "lg";
}) {
  const heights = size === "lg" ? "h-[46px] text-[15px]" : "h-10 text-sm";

  return (
    <fieldset
      disabled={disabled}
      className={cn("m-0 flex min-w-0 flex-col gap-2 border-0 p-0", className)}
    >
      <legend className="text-[14px] font-bold text-foreground">{legend}</legend>
      <div className="flex w-full gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "relative inline-flex flex-1 cursor-pointer items-center justify-center rounded-[10px] border bg-background px-3 font-bold text-foreground transition-colors",
              heights,
              value === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
