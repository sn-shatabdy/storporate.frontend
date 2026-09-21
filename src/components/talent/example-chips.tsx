"use client";

/**
 * STOR-43 Phase 4 — the "Try one of these" row of example chips shown
 * in the idle state. Clicking a chip puts its text in the textarea and
 * moves focus there; it does NOT auto-submit (the user still hits
 * Search). The list of chips is intentionally short — three stable
 * prompts the design canvas called out.
 */
export interface ExampleChipsProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
}

export function ExampleChips({ prompts, onSelect }: ExampleChipsProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Try one of these
      </p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onSelect(prompt)}
            className="rounded-full border bg-card px-3.5 py-[7px] text-[13px] font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            style={{ borderColor: "var(--border)" }}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
