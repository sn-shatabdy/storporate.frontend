import { apiCall } from "./client";

/**
 * STOR-40 Phase 5 — advisor surface for the student. Mirrors the backend's
 * `Storporate.Modules.StudentGrowthExperience` module: 10 endpoints under
 * `/api/growth/explorations` (list/create/get/messages/refresh/retry/title/
 * delete/compare). All requests follow the shared `apiCall` + `ApiError`
 * convention — `ApiError.errorCode` carries the backend's typed
 * `GlobalExceptionHandler` codes (e.g. `exploration_busy`,
 * `exploration_limit_reached`, `compare_needs_two`), and `ApiError.status`
 * carries the HTTP status. Call sites branch on those to surface the right
 * UI state.
 *
 * Wire values are camelCase (the backend serializes with default
 * `JsonNamingPolicy.CamelCase`); the union types below match the C# string
 * enums one-to-one so any drift in the backend enums surfaces as a TS
 * compile error in the Record keys below.
 */

/** Per-student cap mirrored from
 * `Storporate.Modules.StudentGrowthExperience.AdvisorOptions.MaxExplorationsPerStudent`
 * (default 20). Exported here so every call site reads the same constant
 * instead of duplicating the literal — the "You have N explorations" copy
 * on the advisor page, the dashboard card's "of N" suffix (when shown),
 * and the rail row counter are all built from this value. */
export const MAX_EXPLORATIONS_PER_STUDENT = 20;

/** Wire enum for `Exploration.Status`. */
export type ExplorationStatus = "Idle" | "Working" | "Failed";

/** Wire enum for `ExplorationComparison.Status`. */
export type ComparisonStatus = "Pending" | "Completed" | "Failed";

/** Wire enum for the `band` field on gaps. Only `Developing` and `Missing`
 * (or absent) are produced by the AI; `Strong` is never returned because
 * there is no gap to report on a strength (the plan's "no numeric scores"
 * rule + Phase 2 acceptance criterion). */
export type GapBand = "Developing" | "Missing";

/** Wire enum for `ExplorationMessage.Role`. */
export type ExplorationMessageRole = "Student" | "Advisor";

/** Source attribution attached to a suggestion by the backend — populated
 * only when the AI's `sourceItemId` matched a real `FeedItem`. Suggestions
 * without a source render with no link (per plan rule). */
export interface SuggestionSource {
  feedItemId: string;
  title: string;
  url: string;
  sourceName: string;
}

/** One gap in an exploration's latest summary. `band` is optional — the AI
 * may report a gap without a band (per the parser's lenient validation).
 * The field can come back as `null` from a backend that always serializes
 * nullable values, or be missing entirely (undefined) from one that omits
 * nulls — callers should treat both as "no band" via a `== null` check. */
export interface ExplorationGap {
  title: string;
  detail: string;
  band?: GapBand | null;
}

/** One suggestion in an exploration's latest summary. `source` is null
 * (or undefined, depending on backend serializer settings) when the AI
 * didn't reference a `FeedItem`, or when its referenced id didn't
 * resolve on the backend (unknown ids are silently dropped). */
export interface ExplorationSuggestion {
  title: string;
  reason: string;
  nextStep: string;
  source: SuggestionSource | null | undefined;
}

/** The latest summary attached to an exploration. `changeNote` is set on
 * refresh turns ("what changed") and is null on the version that follows
 * the opening turn (may also come back as undefined). */
export interface ExplorationSummary {
  versionNumber: number;
  createdAt: string;
  changeNote?: string | null;
  gaps: ExplorationGap[];
  suggestions: ExplorationSuggestion[];
}

/** One question card emitted by the AI. The student can either pick one of
 * `options` or type a free-text answer; both go back as `answers` on the
 * POST body (see `ExplorationAnswer`). */
export interface ExplorationQuestion {
  prompt: string;
  options: string[];
}

/** One message in an exploration conversation. `questions` is only set on
 * advisor messages that asked the student for structured input (the opening
 * turn, and any follow-up turn where the AI still needs answers); pure
 * text replies leave it null (or undefined). */
export interface ExplorationMessage {
  id: string;
  role: ExplorationMessageRole;
  content: string;
  questions?: ExplorationQuestion[] | null;
  createdAt: string;
}

/** Full detail payload for `GET /api/growth/explorations/{id}` and the
 * create-handler's polling target. `lastError` and `latestSummary` can
 * come back as null from the serializer that always writes nulls, or be
 * absent entirely from one that omits nulls; callers use `== null`. */
export interface ExplorationDetail {
  id: string;
  title: string;
  status: ExplorationStatus;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ExplorationMessage[];
  latestSummary: ExplorationSummary | null | undefined;
}

/** List-row payload for `GET /api/growth/explorations`. `latestVersionNumber`
 * is null when the exploration hasn't produced a summary yet (the opening
 * turn is still in flight, or it failed before writing a summary version).
 * Callers compare with `== null` to handle both null and undefined.
 * Named `ExplorationListItem` (rather than `ExplorationSummary`) to avoid
 * shadowing the {@link ExplorationSummary} record on `ExplorationDetail`,
 * which carries the actual gaps/suggestions payload. */
export interface ExplorationListItem {
  id: string;
  title: string;
  status: ExplorationStatus;
  updatedAt: string;
  latestVersionNumber: number | null | undefined;
}

/** One answer to one of the questions posed in an advisor message. The
 * student types whatever they want (the option they picked, a free-form
 * response, or a combination); the backend stores it verbatim. */
export interface ExplorationAnswer {
  question: string;
  answer: string;
}

/** Body for `POST /api/growth/explorations/{id}/messages`. `content` may be
 * empty when the student only wants to submit answers; `answers` may be
 * omitted entirely when the student is only sending prose. */
export interface AddExplorationMessageRequest {
  content?: string;
  answers?: ExplorationAnswer[];
}

/** Body for `POST /api/growth/explorations/compare`. Backend validates that
 * both ids belong to the caller and that they differ (returns 400
 * `compare_needs_two` if identical). */
export interface CreateComparisonRequest {
  firstExplorationId: string;
  secondExplorationId: string;
}

/** Detail payload for `GET /api/growth/explorations/compare/{id}`. */
export interface ComparisonDetail {
  id: string;
  firstExplorationId: string;
  secondExplorationId: string;
  status: ComparisonStatus;
  resultText?: string | null;
  createdAt: string;
}

/** `GET /api/growth/explorations` — list-row payload, newest update first. */
export async function listExplorations(
  accessToken: string,
  signal?: AbortSignal,
): Promise<ExplorationListItem[]> {
  return apiCall<ExplorationListItem[]>(
    "GET",
    "/api/growth/explorations",
    { bearerToken: accessToken, signal },
  );
}

/** `POST /api/growth/explorations` — opens a new exploration and enqueues
 * the opening-turn `AdvisorTurn` job. Returns `{ id, status: "Working" }`
 * per the README. */
export async function createExploration(
  accessToken: string,
  signal?: AbortSignal,
): Promise<{ id: string; status: ExplorationStatus }> {
  return apiCall<{ id: string; status: ExplorationStatus }>(
    "POST",
    "/api/growth/explorations",
    { bearerToken: accessToken, signal, body: {} },
  );
}

/** `GET /api/growth/explorations/{id}` — full detail (messages + latest
 * summary). Backend returns 404 for other-account ids. */
export async function getExploration(
  id: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<ExplorationDetail> {
  return apiCall<ExplorationDetail>(
    "GET",
    `/api/growth/explorations/${id}`,
    { bearerToken: accessToken, signal },
  );
}

/** `POST /api/growth/explorations/{id}/messages` — submits a student reply
 * and enqueues an `AdvisorTurn(Reply)` job. 202 on success,
 * 409 `exploration_busy` if a previous turn is still in flight. */
export async function addExplorationMessage(
  id: string,
  body: AddExplorationMessageRequest,
  accessToken: string,
  signal?: AbortSignal,
): Promise<{ explorationId: string; newJobId: string }> {
  return apiCall<{ explorationId: string; newJobId: string }>(
    "POST",
    `/api/growth/explorations/${id}/messages`,
    { bearerToken: accessToken, signal, body },
  );
}

/** `POST /api/growth/explorations/{id}/refresh` — enqueues a refresh turn
 * that re-asks the AI to update the gaps/suggestions summary with a fresh
 * `changeNote`. 202 on success, 409 `exploration_busy` if a previous turn
 * is still in flight. */
export async function refreshExploration(
  id: string,
  accessToken: string,
): Promise<void> {
  await apiCall<void>(
    "POST",
    `/api/growth/explorations/${id}/refresh`,
    { bearerToken: accessToken },
  );
}

/** `POST /api/growth/explorations/{id}/retry` — re-enqueues the last
 * failed turn. 202 on success, 409 `exploration_not_retryable` when the
 * exploration is not currently `Failed`. */
export async function retryExploration(
  id: string,
  accessToken: string,
): Promise<void> {
  await apiCall<void>(
    "POST",
    `/api/growth/explorations/${id}/retry`,
    { bearerToken: accessToken },
  );
}

/** `PUT /api/growth/explorations/{id}/title` — renames an exploration.
 * 204 on success; 400 `title_required` / `title_too_long` on bad input. */
export async function renameExploration(
  id: string,
  title: string,
  accessToken: string,
): Promise<void> {
  await apiCall<void>(
    "PUT",
    `/api/growth/explorations/${id}/title`,
    { bearerToken: accessToken, body: { title } },
  );
}

/** `DELETE /api/growth/explorations/{id}` — removes the exploration and
 * all its dependents (messages, summary versions, comparisons on either
 * side). 204 on success; 404 for other-account ids. */
export async function deleteExploration(
  id: string,
  accessToken: string,
): Promise<void> {
  await apiCall<void>(
    "DELETE",
    `/api/growth/explorations/${id}`,
    { bearerToken: accessToken },
  );
}

/** `POST /api/growth/explorations/compare` — creates a comparison and
 * enqueues `CompareExplorations`. Returns 202 with the new comparison id;
 * 400 `compare_needs_two` if the two ids are identical; 404 for other-
 * account ids; 409 `exploration_has_no_summary` if either side hasn't
 * produced a summary yet. */
export async function createComparison(
  body: CreateComparisonRequest,
  accessToken: string,
): Promise<{ comparisonId: string }> {
  return apiCall<{ comparisonId: string }>(
    "POST",
    "/api/growth/explorations/compare",
    { bearerToken: accessToken, body },
  );
}

/** `GET /api/growth/explorations/compare/{id}` — reads the comparison's
 * current state. 404 for other-account ids. */
export async function getComparison(
  id: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<ComparisonDetail> {
  return apiCall<ComparisonDetail>(
    "GET",
    `/api/growth/explorations/compare/${id}`,
    { bearerToken: accessToken, signal },
  );
}
