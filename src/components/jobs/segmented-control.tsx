"use client";

import { cn } from "cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * Segmented control built on native radio inputs, so arrow keys, focus and
 * screen reader semantics come for free. The visible segment is the label.
 */
export function SegmentedControl<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  disabled,
  className,
}: {
  name: string;
  legend: string;
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <fieldset
      disabled={disabled}
      className={cn("m-0 min-w-0 border-0 p-0", className)}
    >
      <legend className="sr-only">{legend}</legend>
      <div className="inline-flex w-fit max-w-full rounded-lg border bg-muted/40 p-1">
        {options.map((o) => (
          <label
            key={o.value}
            className="relative inline-flex h-8 cursor-pointer items-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground has-checked:bg-background has-checked:font-semibold has-checked:text-foreground has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-ring/40 has-disabled:cursor-not-allowed has-disabled:opacity-60"
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
