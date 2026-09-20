"use client";

import { initialsFor, previewItemsLine, previewLineFor } from "./helpers";
import type { ProfileDraft } from "./helpers";

/**
 * STOR-43 Phase 3 — the on-state "How employers see you" preview card.
 * Reads from the DRAFT (not the saved profile) so the preview updates the
 * instant the student toggles a switch or types in a field.
 *
 * Layout:
 *   - Row 1: avatar tile + name (or muted "Your name" placeholder when
 *     empty) + optional headline under the name.
 *   - Row 2 (only when at least one of university/field/year is shown):
 *     a flex-wrap line of the visible parts joined by " · ", followed by
 *     the "Self-reported" pill.
 *   - Row 3: a muted line that pluralizes the portfolio item count and
 *     never invents sample skills.
 */
export interface ProfilePreviewCardProps {
  draft: ProfileDraft;
  visibleItemCount: number;
}

export function ProfilePreviewCard({
  draft,
  visibleItemCount,
}: ProfilePreviewCardProps) {
  const trimmedName = draft.displayName.trim();
  const preview = previewLineFor({
    university: draft.university,
    fieldOfStudy: draft.fieldOfStudy,
    studyYear: draft.studyYear,
    showUniversity: draft.showUniversity,
    showFieldOfStudy: draft.showFieldOfStudy,
    showStudyYear: draft.showStudyYear,
  });

  return (
    <section
      className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      style={{ borderColor: "var(--border)" }}
    >
      <header>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          How employers see you
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          This preview follows your switches.
        </p>
      </header>

      <div
        className="flex flex-col gap-3 rounded-[14px] border p-[18px_20px]"
        style={{ borderColor: "var(--border)", background: "#fbf8ec" }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-accent text-primary font-heading text-[15px] font-semibold"
          >
            {initialsFor(trimmedName)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="break-words font-heading text-base font-semibold text-foreground">
              {trimmedName.length > 0 ? trimmedName : (
                <span className="text-muted-foreground">Your name</span>
              )}
            </p>
            {draft.showHeadline && draft.headline.trim().length > 0 && (
              <p className="mt-0.5 break-words text-[13px] text-muted-foreground">
                {draft.headline.trim()}
              </p>
            )}
          </div>
        </div>

        {preview.hasAnyShownPart && (
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
            {preview.parts.map((part, idx) => (
              <span key={`${part}-${idx}`} className="break-words">
                {part}
              </span>
            ))}
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-foreground"
              style={{ backgroundColor: "var(--secondary)" }}
            >
              Self-reported
            </span>
          </div>
        )}

        <p className="text-[13px] text-muted-foreground">
          {previewItemsLine(visibleItemCount)}
        </p>
      </div>
    </section>
  );
}
