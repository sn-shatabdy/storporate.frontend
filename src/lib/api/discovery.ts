import { apiCall } from "./client";

/**
 * STOR-43 Phase 3 — discovery surface client for the student. Mirrors the
 * backend's `GET` and `PUT /api/discovery/searchable-profile` endpoints
 * added in Phase 1 (see `stor-43-plain-language-talent-search-plan.md`).
 *
 * Wire values are camelCase (the backend serializes with default
 * `JsonNamingPolicy.CamelCase`). All requests follow the shared `apiCall` +
 * `ApiError` convention — `ApiError.errorCode` carries the backend's typed
 * `GlobalExceptionHandler` codes (e.g. `display_name_required`,
 * `display_name_too_long`, `headline_too_long`, `permission_denied`).
 */

/** GET / PUT payload — every wire field exposed by the endpoint. The
 *  optional text fields are nullable; `show*` are always booleans;
 *  `optedInAt` / `updatedAt` are ISO-8601 strings (or null for `optedInAt`
 *  if the student has never flipped the switch on). `visibleItemCount` is
 *  the count of portfolio items that contribute to the index (analyzed
 *  items with at least one Strong or Developing finding). */
export interface SearchableProfile {
  isSearchable: boolean;
  displayName: string;
  headline: string | null;
  university: string | null;
  fieldOfStudy: string | null;
  studyYear: number | null;
  showHeadline: boolean;
  showUniversity: boolean;
  showFieldOfStudy: boolean;
  showStudyYear: boolean;
  optedInAt: string | null;
  updatedAt: string;
  visibleItemCount: number;
}

/** PUT body — every field is optional on the wire (omitted means unchanged)
 *  EXCEPT the backend stores an empty string as null for text fields. The
 *  call site is responsible for sending every field it wants to persist;
 *  omitted fields stay at their stored value. */
export interface UpdateSearchableProfileRequest {
  isSearchable?: boolean;
  /** Empty string clears (backend stores null). Omit to leave unchanged. */
  displayName?: string;
  /** Empty string clears (backend stores null). Omit to leave unchanged. */
  headline?: string;
  /** Empty string clears (backend stores null). Omit to leave unchanged. */
  university?: string;
  /** Empty string clears (backend stores null). Omit to leave unchanged. */
  fieldOfStudy?: string;
  /** 1 to 8 to set; the endpoint has no "clear" verb for study year. */
  studyYear?: number | null;
  showHeadline?: boolean;
  showUniversity?: boolean;
  showFieldOfStudy?: boolean;
  showStudyYear?: boolean;
}

/** `GET /api/discovery/searchable-profile` — fetch the signed-in student's
 *  current opt-in state. A student with no row yet gets the backend's
 *  defaults (isSearchable false, displayName "", nulls, all show* true).
 *  Returns 403 permission_denied for non-Students. */
export async function getSearchableProfile(
  bearerToken: string,
  signal?: AbortSignal,
): Promise<SearchableProfile> {
  return apiCall<SearchableProfile>(
    "GET",
    "/api/discovery/searchable-profile",
    { bearerToken, signal },
  );
}

/** `PUT /api/discovery/searchable-profile` — persist the student's draft.
 *  Returns the same shape as GET with the new stored values. 400 for
 *  validation errors, 403 for non-Students, 401 unauthenticated. */
export async function updateSearchableProfile(
  bearerToken: string,
  body: UpdateSearchableProfileRequest,
  signal?: AbortSignal,
): Promise<SearchableProfile> {
  return apiCall<SearchableProfile>(
    "PUT",
    "/api/discovery/searchable-profile",
    { bearerToken, signal, body },
  );
}
