"use client";

import type { CandidateReview } from "@/lib/api/candidateReview";

import { composeDetailLine, initialsFor } from "./helpers";

/**
 * STOR-44 Phase 4 — the candidate-header card at the top of the
 * drill-down page. Reads the same `composeDetailLine` / `initialsFor`
 * helpers the result-card uses so the two surfaces never drift on
 * the "University · Field · Year N" row or the initials algorithm.
 *
 * Layout (per the approved canvas):
 *   - Row 1: initials tile (size-14) + display name (28 px Space
 *     Grotesk semibold) and, if present, the headline (muted).
 *   - Row 2 (only when at least one of university / fieldOfStudy /
 *     studyYear is present): the joined detail line + the
 *     "Self-reported" pill.
 */
export interface CandidateHeaderProps {
  candidate: CandidateReview;
}

export function CandidateHeader({ candidate }: CandidateHeaderProps) {
  const detailLine = composeDetailLine({
    university: candidate.university,
    fieldOfStudy: candidate.fieldOfStudy,
    studyYear: candidate.studyYear,
  });
  const hasHeadline =
    candidate.headline !== null && candidate.headline.trim().length > 0;
  return (
    <section
      className="flex flex-col gap-3 border bg-card p-5 shadow-sm sm:p-6"
      style={{
        borderRadius: 16,
        borderColor: "var(--border)",
        boxShadow: "0 1px 2px rgba(42,24,48,0.06)",
      }}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-accent text-primary font-heading text-xl font-semibold"
        >
          {initialsFor(candidate.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="break-words font-heading text-[28px] font-semibold leading-tight tracking-tight text-foreground">
            {candidate.displayName}
          </h1>
          {hasHeadline && (
            <p className="mt-0.5 break-words text-sm text-muted-foreground">
              {candidate.headline}
            </p>
          )}
        </div>
      </div>

      {detailLine.hasAnyShownPart && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
          {detailLine.parts.map((part, idx) => (
            <span key={`${part}-${idx}`} className="break-words">
              {part}
            </span>
          ))}
          <span
            className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground"
          >
            Self-reported
          </span>
        </div>
      )}
    </section>
  );
}
