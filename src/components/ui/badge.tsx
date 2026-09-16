import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "cn";

/**
 * The first shared badge primitive in this app. Renders a <span> with the
 * shared pill shape (rounded-full, fixed-pitch label size) and accepts
 * `background` / `color` as plain CSS color strings — applied via inline
 * `style`, NOT Tailwind palette classes — because the approved hex pairs
 * don't all map to this app's Tailwind theme scale.
 *
 * Uses `cva` with only the base class string (no variant surface yet) so the
 * file's shape mirrors `src/components/ui/button.tsx`'s `cva(...)` opening
 * line and a future variant addition only needs to fill in the second arg.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
);

export interface BadgeProps extends Omit<React.ComponentProps<"span">, "color"> {
  /** CSS background color — applied via inline `style`. */
  background?: string;
  /** CSS text color — applied via inline `style`. */
  color?: string;
}

function Badge({ className, background, color, style, children, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ className }))}
      style={{ backgroundColor: background, color, ...(style ?? {}) }}
      {...props}
    >
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
