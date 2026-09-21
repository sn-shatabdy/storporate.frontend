import { Check } from "lucide-react";

import { REASONS_SHOWN } from "./matching-helpers";

/** Up to four plain-language reasons a match was suggested. */
export function ReasonList({ reasons }: { reasons: string[] }) {
  const shown = reasons.slice(0, REASONS_SHOWN);
  if (shown.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Why it fits">
      {shown.map((reason) => (
        <li key={reason} className="flex items-start gap-2 text-sm text-foreground">
          <span
            aria-hidden
            className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-primary"
          >
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
          <span className="min-w-0 break-words">{reason}</span>
        </li>
      ))}
    </ul>
  );
}
