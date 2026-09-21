"use client";

import { Search } from "lucide-react";

/**
 * STOR-43 Phase 4 — the "no matching students" empty state shown when
 * the backend returns Completed with an empty results array. Centered
 * card with a Search icon in a muted circle, a heading, and a hint
 * sentence that nudges the employer to rephrase or name the skills
 * they need.
 */
export function NoResultsState() {
  return (
    <div
      role="status"
      className="mx-auto flex w-full max-w-[520px] flex-col items-center gap-3.5 rounded-2xl border bg-card px-6 py-12 text-center shadow-sm sm:px-14"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground"
      >
        <Search className="size-5" aria-hidden />
      </span>
      <h3 className="font-heading text-lg font-semibold text-foreground">
        No matching students
      </h3>
      <p className="max-w-[360px] text-sm text-muted-foreground">
        Try naming the skills you need, or describe the role in different
        words.
      </p>
    </div>
  );
}
