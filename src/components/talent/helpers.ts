/**
 * STOR-43 Phase 4 — pure helpers for the employer "Find students" page.
 *
 * Three concerns live here:
 *
 *   1. Presentation composition for result cards:
 *      - `initialsFor` (already shared with Phase 3 via the same
 *        algorithm; we re-import from discovery/helpers rather than
 *        copy so the two pages can never drift on the algorithm).
 *      - `composeDetailLine` builds the "University · Field · Year N"
 *        row and reports whether any part is present (drives the
 *        "Self-reported" pill).
 *
 *   2. Client-side validation for the search box:
 *      - `validateQuery` maps the trimmed query into one of three
 *        states: "valid" (>= 10 and <= 1000), "too_short" (trimmed
 *        under 10 chars when the user has typed something), or
 *        "too_long" (over 1000 chars). The empty case is also a
 *        valid state (so the Search button stays disabled with a
 *        neutral counter rather than an error).
 *
 *   3. Backend `errorCode` -> human message mapping for the search
 *      box. Reuses the same naming convention as Phase 3's
 *      `errorCodeToField` so the page can switch on a known set of
 *      wire codes without leaking backend strings.
 */

import { initialsFor as discoveryInitialsFor } from "@/components/discovery/helpers";

/** Re-export so talent-result-card.tsx can read "initialsFor" from one
 *  place without depending on the discovery module's deep path. The
 *  algorithm is identical; the original is unit-tested under
 *  `src/components/discovery/helpers.test.ts` so we don't re-test here. */
export const initialsFor = discoveryInitialsFor;

/** Inputs for the result-card detail line. Any of university /
 *  fieldOfStudy / studyYear may be null when the student hid that
 *  field. `studyYear` is null when not set or not shown. */
export interface DetailLineInput {
  university: string | null;
  fieldOfStudy: string | null;
  studyYear: number | null;
}

export interface DetailLine {
  /** Parts joined with " · " for the result card. Empty when every
   *  part is hidden / null. */
  parts: string[];
  /** True iff at least one part is present, so the page can decide
   *  whether to render the "Self-reported" pill. */
  hasAnyShownPart: boolean;
}

/** Build the "University · Field of study · Year N" row. Parts are
 *  ordered university → field of study → Year N. A part is hidden
 *  when its trimmed value is empty (covers both null and ""), and
 *  studyYear is hidden when null. The caller passes the
 *  already-applied visibility flags (we do not know about them here
 *  — the page uses the wire shape, which already reflects what the
 *  student hid). */
export function composeDetailLine(input: DetailLineInput): DetailLine {
  const parts: string[] = [];
  if (input.university !== null && input.university.trim().length > 0) {
    parts.push(input.university.trim());
  }
  if (
    input.fieldOfStudy !== null &&
    input.fieldOfStudy.trim().length > 0
  ) {
    parts.push(input.fieldOfStudy.trim());
  }
  if (input.studyYear !== null) {
    parts.push(`Year ${input.studyYear}`);
  }
  return { parts, hasAnyShownPart: parts.length > 0 };
}

/** Validation states for the search query box. The page maps each state
 *  to a Search-button enable/disable decision + an inline message.
 *
 *  - `empty`: the user has typed nothing; button disabled, counter
 *    shows the "0 of 1000 characters..." idle copy, no error.
 *  - `too_short`: trimmed length < 10; button disabled, red message
 *    under the textarea. No request is ever sent.
 *  - `too_long`: trimmed length > 1000; button disabled, red message
 *    under the textarea.
 *  - `valid`: trimmed length is between 10 and 1000 inclusive;
 *    button enabled. The backend will reject outside this range as a
 *    defense-in-depth, but the client prevents it first. */
export type QueryValidationState =
  | { kind: "empty" }
  | { kind: "too_short"; trimmedLength: number }
  | { kind: "too_long"; trimmedLength: number }
  | { kind: "valid"; trimmedLength: number };

export const MIN_QUERY_CHARS = 10;
export const MAX_QUERY_CHARS = 1000;

export function validateQuery(rawQuery: string): QueryValidationState {
  const trimmedLength = rawQuery.trim().length;
  if (trimmedLength === 0) {
    return { kind: "empty" };
  }
  if (trimmedLength < MIN_QUERY_CHARS) {
    return { kind: "too_short", trimmedLength };
  }
  if (trimmedLength > MAX_QUERY_CHARS) {
    return { kind: "too_long", trimmedLength };
  }
  return { kind: "valid", trimmedLength };
}

/** Inline message shown under the textarea for a too-short / too-long
 *  query. Returns `null` for `empty` and `valid` so the page doesn't
 *  render a redundant "looks good" line. */
export function messageForQueryValidation(
  state: QueryValidationState,
): string | null {
  switch (state.kind) {
    case "too_short":
      return "Write at least 10 characters.";
    case "too_long":
      return "Use 1000 characters or fewer.";
    case "empty":
    case "valid":
      return null;
  }
}

/** Counter copy shown beside the Search button. Two states:
 *  - idle: when the user hasn't typed yet.
 *  - typed: once the textarea is non-empty.
 *  The page always shows the raw (untrimmed) character count in the
 *  typed state, so the counter matches what the user sees in the box. */
export function counterLine(rawQuery: string): string {
  const trimmed = rawQuery.trim();
  if (trimmed.length === 0) {
    return "0 of 1000 characters. A search can take up to a minute.";
  }
  return `${rawQuery.length} of 1000 characters.`;
}

/** Result-count line shown above the result list. Uses the agreed
 *  pluralization (1 student vs N students) and the same "best match
 *  first" suffix the design calls for. */
export function resultsCountLine(count: number): string {
  if (count === 1) return "1 student, best match first";
  return `${count} students, best match first`;
}

/** Screen-reader-only summary of how many candidates were found, used
 *  inside the role="status" region when results land. Mirrors the
 *  results header copy minus the "best match first" suffix (which is
 *  visual context, not a count). */
export function srResultsAnnouncement(count: number): string {
  if (count === 0) return "No matching students.";
  if (count === 1) return "1 student found.";
  return `${count} students found.`;
}

/** The set of `errorCode` values the page may surface from the search
 *  backend. Phase 4 only handles the ones tied to query validation and
 *  the busy state — everything else falls through to the
 *  failed-state treatment. */
export type TalentSearchErrorCode =
  | "talent_search_query_required"
  | "talent_search_query_too_short"
  | "talent_search_query_too_long"
  | "talent_search_busy";

/** Inline message for a known POST errorCode. Mirrors the field-level
 *  message function from Phase 3: returns null for codes that don't
 *  have a field-style message, so the caller falls back to the
 *  failed treatment. The page also uses this for GET errors that map
 *  to a busy / validation condition (which the backend does not emit
 *  from GET today, but the mapping is forward-compatible). */
export function messageForTalentSearchError(
  errorCode: string,
): string | null {
  switch (errorCode) {
    case "talent_search_query_required":
    case "talent_search_query_too_short":
      return "Write at least 10 characters.";
    case "talent_search_query_too_long":
      return "Use 1000 characters or fewer.";
    case "talent_search_busy":
      return "A search is already running. Wait for it to finish.";
    default:
      return null;
  }
}
