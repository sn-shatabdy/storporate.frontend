import * as React from "react";
import { cn } from "cn";

/**
 * STOR-43 Phase 3 — generic single-line text input primitive. Mirrors the
 * existing portfolio-page input shape (`h-9 rounded-md border border-input
 * bg-background px-2.5 text-sm text-foreground outline-none focus-visible
 * :ring-2 focus-visible:ring-ring/40`) but lifted into a reusable primitive
 * so Phase 4 (employer search) can also reach for it without copy-paste.
 *
 * ForwardRef-free React 19 function component that spreads the rest of the
 * native `<input>` props — so callers can keep `type`, `value`,
 * `onChange`, `id`, `placeholder`, etc. Class names are merged via `cn`.
 *
 * `aria-invalid` swaps the border to the destructive hex (#b3261e) so the
 * validation error story stays visual-and-semantic in one attribute.
 */
function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-[#b3261e]",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
