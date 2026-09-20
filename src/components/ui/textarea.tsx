import * as React from "react";
import { cn } from "cn";

/**
 * STOR-43 Phase 3 — multi-line text input primitive. Built now so both the
 * student visibility page (Phase 3) and the employer search description box
 * (Phase 4) can reach for it. Slightly taller than the advisor composer
 * (`min-h-[96px]` vs the advisor's `72px`) because free-text profile fields
 * like "headline" are meant to be one or two sentences.
 *
 * ForwardRef-free React 19 function component that spreads the rest of the
 * native `<textarea>` props — `value`, `onChange`, `placeholder`, `rows`
 * etc. all pass through untouched. `aria-invalid` switches the border to
 * the destructive red so the validation error stays both visual and
 * semantic in one attribute.
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "block min-h-[96px] w-full resize-none rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-6 text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60 aria-invalid:border-[#b3261e]",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
