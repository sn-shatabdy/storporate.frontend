import type {
  SearchableProfile,
  UpdateSearchableProfileRequest,
} from "@/lib/api/discovery";

/**
 * STOR-43 Phase 3 — pure helpers for the student visibility page. Kept in
 * a colocated module (no React, no fetch) so the page and its
 * subcomponents share the exact same string composition, dirty detection,
 * and error-code mapping. Every helper is unit-tested under
 * `helpers.test.ts`.
 */

/** The form's working draft — mirrors the wire shape but uses local types
 *  so the form can express intermediate states the wire can't (empty
 *  string vs unset). */
export interface ProfileDraft {
  isSearchable: boolean;
  displayName: string;
  headline: string;
  university: string;
  fieldOfStudy: string;
  studyYear: number | null;
  showHeadline: boolean;
  showUniversity: boolean;
  showFieldOfStudy: boolean;
  showStudyYear: boolean;
}

/** Build the form's draft from a fetched profile. Wire `null` text fields
 *  land as empty strings so the inputs can stay uncontrolled-friendly
 *  (and so the student can type a value to "set" a previously-cleared
 *  field). `null` `studyYear` becomes `null` (no year chosen). */
export function draftFromProfile(profile: SearchableProfile): ProfileDraft {
  return {
    isSearchable: profile.isSearchable,
    displayName: profile.displayName ?? "",
    headline: profile.headline ?? "",
    university: profile.university ?? "",
    fieldOfStudy: profile.fieldOfStudy ?? "",
    studyYear: profile.studyYear,
    showHeadline: profile.showHeadline,
    showUniversity: profile.showUniversity,
    showFieldOfStudy: profile.showFieldOfStudy,
    showStudyYear: profile.showStudyYear,
  };
}

/** Build the PUT body from the form's draft. Empty optional text fields
 *  serialize as `""` (the backend stores those as null); `studyYear` is
 *  omitted entirely when the student hasn't chosen one (per the design:
 *  the endpoint has no clear verb for study year). Every field is sent so
 *  the backend never has to fall back to "unchanged" for our draft. */
export function requestFromDraft(draft: ProfileDraft): UpdateSearchableProfileRequest {
  const body: UpdateSearchableProfileRequest = {
    isSearchable: draft.isSearchable,
    displayName: draft.displayName.trim(),
    headline: draft.headline,
    university: draft.university,
    fieldOfStudy: draft.fieldOfStudy,
    showHeadline: draft.showHeadline,
    showUniversity: draft.showUniversity,
    showFieldOfStudy: draft.showFieldOfStudy,
    showStudyYear: draft.showStudyYear,
  };
  if (draft.studyYear !== null) {
    body.studyYear = draft.studyYear;
  }
  return body;
}

/** Compare a draft to a saved profile. We compare the trimmed displayName
 *  (the backend stores it trimmed) and the literal text for the optional
 *  fields (the backend stores them verbatim, including leading/trailing
 *  spaces the student typed). Used by the page to decide whether the Save
 *  button is enabled and whether the "unsaved changes" status shows. */
export function isDraftDirty(
  draft: ProfileDraft,
  saved: SearchableProfile,
): boolean {
  if (draft.isSearchable !== saved.isSearchable) return true;
  if (draft.displayName.trim() !== (saved.displayName ?? "").trim()) return true;
  if ((draft.headline ?? "") !== (saved.headline ?? "")) return true;
  if ((draft.university ?? "") !== (saved.university ?? "")) return true;
  if ((draft.fieldOfStudy ?? "") !== (saved.fieldOfStudy ?? "")) return true;
  if (draft.studyYear !== saved.studyYear) return true;
  if (draft.showHeadline !== saved.showHeadline) return true;
  if (draft.showUniversity !== saved.showUniversity) return true;
  if (draft.showFieldOfStudy !== saved.showFieldOfStudy) return true;
  if (draft.showStudyYear !== saved.showStudyYear) return true;
  return false;
}

/** First-letter initials for the preview avatar. Up to two words of the
 *  display name, uppercase; "?" when empty. Whitespace + punctuation
 *  boundaries only (so e.g. "Jean-Paul" stays "J", "Nadia Rahman" → "NR"). */
export function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "?";
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return "?";
  const first = (words[0][0] ?? "").toUpperCase();
  if (words.length === 1) return first || "?";
  const second = (words[1][0] ?? "").toUpperCase();
  return first + second || "?";
}

/** Compose the secondary preview line (university · field · year N),
 *  joined with the middle dot. Each piece is hidden when its show switch
 *  is off or the underlying value is empty (and the "Self-reported" pill
 *  only appears when at least one of those three is shown). Returns the
 *  parts joined by " · " (no trailing separator). */
export interface PreviewLineInput {
  university: string;
  fieldOfStudy: string;
  studyYear: number | null;
  showUniversity: boolean;
  showFieldOfStudy: boolean;
  showStudyYear: boolean;
}

export interface PreviewLine {
  parts: string[];
  /** True when at least one of university/field/year is shown. Drives the
   *  "Self-reported" pill on the preview card. */
  hasAnyShownPart: boolean;
}

export function previewLineFor(input: PreviewLineInput): PreviewLine {
  const parts: string[] = [];
  if (input.showUniversity && input.university.trim().length > 0) {
    parts.push(input.university.trim());
  }
  if (input.showFieldOfStudy && input.fieldOfStudy.trim().length > 0) {
    parts.push(input.fieldOfStudy.trim());
  }
  if (input.showStudyYear && input.studyYear !== null) {
    parts.push(`Year ${input.studyYear}`);
  }
  return { parts, hasAnyShownPart: parts.length > 0 };
}

/** Master-switch status line for the visibility card. Reads from the
 *  DRAFT (so it updates immediately on toggle) and uses the live
 *  `visibleItemCount` from the last saved profile. Pluralizes 0 / 1 / N
 *  for both the on and off states. */
export function masterStatusLine(
  isSearchable: boolean,
  visibleItemCount: number,
): string {
  if (!isSearchable) {
    return "Off. Employers cannot see you or your portfolio.";
  }
  if (visibleItemCount === 0) {
    return "On. No portfolio items are ready yet. Analyze an item in My Portfolio to appear in searches.";
  }
  if (visibleItemCount === 1) {
    return "On. 1 portfolio item is visible in employer searches.";
  }
  return `On. ${visibleItemCount} portfolio items are visible in employer searches.`;
}

/** Footer line for the off-state "What employers would see" card. Same
 *  pluralization as the master status. */
export function offStateFooterLine(visibleItemCount: number): string {
  if (visibleItemCount === 0) {
    return "No portfolio items are ready yet. Analyze an item in My Portfolio first.";
  }
  if (visibleItemCount === 1) {
    return "1 portfolio item is ready to appear once you turn this on.";
  }
  return `${visibleItemCount} portfolio items are ready to appear once you turn this on.`;
}

/** Bottom line of the on-state preview card (the "portfolio items appear
 *  with these details" line). Same pluralization as the footer. */
export function previewItemsLine(visibleItemCount: number): string {
  if (visibleItemCount === 0) {
    return "Your portfolio items and skills appear here once you have an analyzed item.";
  }
  if (visibleItemCount === 1) {
    return "1 portfolio item and its skills appear with these details.";
  }
  return `${visibleItemCount} portfolio items and their skills appear with these details.`;
}

/** Field-name → validation error message, for inline field-level errors.
 *  The empty-name check is the only validation that depends on whether
 *  the master switch is on (the displayName is only required when the
 *  student is opting in). The other rules (length caps) always apply. */
export type DiscoveryFieldError =
  | "display_name_required"
  | "display_name_too_long"
  | "headline_too_long"
  | "university_too_long"
  | "field_of_study_too_long";

export function validateDraft(
  draft: ProfileDraft,
  opts: { requireDisplayName: boolean },
): Partial<Record<keyof ProfileDraft, DiscoveryFieldError>> {
  const errors: Partial<Record<keyof ProfileDraft, DiscoveryFieldError>> = {};
  if (opts.requireDisplayName && draft.displayName.trim().length === 0) {
    errors.displayName = "display_name_required";
  } else if (draft.displayName.trim().length > 80) {
    errors.displayName = "display_name_too_long";
  }
  if (draft.headline.length > 120) {
    errors.headline = "headline_too_long";
  }
  if (draft.university.length > 120) {
    errors.university = "university_too_long";
  }
  if (draft.fieldOfStudy.length > 120) {
    errors.fieldOfStudy = "field_of_study_too_long";
  }
  return errors;
}

/** Human-friendly message for a single field-level errorCode (mirrors the
 *  client-side messages so the page uses one message function everywhere).
 *  Returns `null` for codes that don't map to a field (callers should use
 *  the form-level fallback for those). */
export function messageForFieldError(
  code: DiscoveryFieldError,
): string | null {
  switch (code) {
    case "display_name_required":
      return "Enter a display name.";
    case "display_name_too_long":
      return "Use 80 characters or fewer.";
    case "headline_too_long":
    case "university_too_long":
    case "field_of_study_too_long":
      return "Use 120 characters or fewer.";
    default:
      return null;
  }
}

/** Map a backend errorCode to the field-level code the page renders. Used
 *  by the page's PUT error path so the inline message appears under the
 *  right input. `study_year_out_of_range` has no key (no draft field
 *  represents the year); the page surfaces it via a generic form-level
 *  alert. Unknown codes map to null so the caller shows the generic
 *  "Could not save your changes" alert instead. */
export function errorCodeToField(
  code: string,
): { field: keyof ProfileDraft; code: DiscoveryFieldError } | null {
  switch (code) {
    case "display_name_required":
      return { field: "displayName", code: "display_name_required" };
    case "display_name_too_long":
      return { field: "displayName", code: "display_name_too_long" };
    case "headline_too_long":
      return { field: "headline", code: "headline_too_long" };
    case "university_too_long":
      return { field: "university", code: "university_too_long" };
    case "field_of_study_too_long":
      return { field: "fieldOfStudy", code: "field_of_study_too_long" };
    default:
      return null;
  }
}

/** Human-friendly message for the `study_year_out_of_range` errorCode. */
export function messageForStudyYearRangeError(): string {
  return "Choose a year from 1 to 8.";
}
