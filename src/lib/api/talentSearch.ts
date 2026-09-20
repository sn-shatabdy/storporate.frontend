import { apiCall } from "./client";

/**
 * STOR-43 Phase 4 — employer "Find students" surface client. Mirrors the
 * backend's `POST /api/discovery/talent-searches` (returns 202 + a
 * `searchId`) and `GET /api/discovery/talent-searches/{id}` endpoints added
 * in Phase 2 (see `stor-43-plain-language-talent-search-plan.md`).
 *
 * Wire values are camelCase (the backend serializes with default
 * `JsonNamingPolicy.CamelCase`). All requests follow the shared `apiCall` +
 * `ApiError` convention — `ApiError.errorCode` carries the backend's typed
 * `GlobalExceptionHandler` codes:
 *   - `talent_search_query_required` (400)
 *   - `talent_search_query_too_short` (400)
 *   - `talent_search_query_too_long` (400)
 *   - `talent_search_busy` (409 — this Organization already has a Pending search)
 *   - `permission_denied` (403 — non-Organization caller)
 *   - 401 unauthenticated
 */

/** The three statuses the backend can return for a talent search. */
export type TalentSearchStatus = "Pending" | "Completed" | "Failed";

/** A single matched skill on a candidate. Bands are pinned to the two
 *  the backend can emit (`Strong` / `Developing`); the Missing band is
 *  excluded from results entirely. */
export type TalentSearchBand = "Strong" | "Developing";

/** One skill that contributed to the match. */
export interface TalentSearchMatchedSkill {
  name: string;
  band: TalentSearchBand;
}

/** One portfolio item the backend cited as backing the reason. `band`
 *  describes the strength of the skill the backend picked for this
 *  citation. */
export interface TalentSearchCitedItem {
  portfolioItemId: string;
  label: string;
  category: string;
  skillName: string;
  band: TalentSearchBand;
}

/** One candidate in the result list. The list is already ordered best
 *  match first by the backend; the page renders it verbatim.
 *
 *  `headline` / `university` / `fieldOfStudy` / `studyYear` are null when
 *  the student hid those fields in their visibility profile. The page
 *  renders only the parts that are present. */
export interface TalentSearchResultItem {
  candidateId: string;
  displayName: string;
  headline: string | null;
  university: string | null;
  fieldOfStudy: string | null;
  studyYear: number | null;
  matchedSkills: TalentSearchMatchedSkill[];
  reason: string;
  citedItems: TalentSearchCitedItem[];
}

/** Full GET response. `results` is `null` until the search has Completed;
 *  on Completed it may be an empty array (no candidates). `errorCode` is
 *  non-null only on Failed. `completedAt` is null while Pending. */
export interface TalentSearch {
  id: string;
  status: TalentSearchStatus;
  query: string;
  createdAt: string;
  completedAt: string | null;
  results: TalentSearchResultItem[] | null;
  errorCode: string | null;
}

/** Body for `POST /api/discovery/talent-searches`. The page trims the
 *  query before sending so server-side trimming and client-side
 *  trimming agree on what "10 characters" means. */
export interface CreateTalentSearchRequest {
  query: string;
}

/** POST response. Just the search id; the GET endpoint is the source of
 *  truth for status + results. */
export interface CreateTalentSearchResponse {
  searchId: string;
}

/** `POST /api/discovery/talent-searches` — kick off a background search.
 *  Returns 202 + `{ searchId }`. Throws `ApiError` on 400/403/409/etc —
 *  the page reads `errorCode` to decide between the inline message and
 *  the failed-state treatment. */
export async function createTalentSearch(
  bearerToken: string,
  body: CreateTalentSearchRequest,
  signal?: AbortSignal,
): Promise<CreateTalentSearchResponse> {
  return apiCall<CreateTalentSearchResponse>(
    "POST",
    "/api/discovery/talent-searches",
    { bearerToken, signal, body },
  );
}

/** `GET /api/discovery/talent-searches/{id}` — poll for status + results.
 *  Returns 404 if the id is not this Organization's; the page treats
 *  that as "the search cannot be found" and stops polling. */
export async function getTalentSearch(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<TalentSearch> {
  return apiCall<TalentSearch>(
    "GET",
    `/api/discovery/talent-searches/${encodeURIComponent(id)}`,
    { bearerToken, signal },
  );
}
