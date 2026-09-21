import { apiCall } from "./client";

/**
 * STOR-70 sponsorship goals client.
 *
 * Organization endpoints manage the company's own goal sets. Club endpoints
 * browse the active ones. Wire values are camelCase. Errors are `ApiError`
 * with `errorCode`:
 *   - `sponsorship_goal_not_found` (404)
 *   - `sponsorship_goal_audience_required` (400)
 *   - other 400 validation errors are prefixed `sponsorship_goal_` and carry
 *     a readable `message`
 */

export const OBJECTIVES = [
  "Brand awareness",
  "Recruiting",
  "CSR education",
  "Community outreach",
  "Product launch",
  "Other",
] as const;

export const EVENT_KINDS = [
  "Hackathon",
  "Competition",
  "Workshop",
  "Career fair",
  "Conference",
  "Cultural event",
  "Sports event",
  "Seminar",
] as const;

export const STUDY_YEARS = [1, 2, 3, 4, 5, 6] as const;

export type GoalSetStatus = "Active" | "Paused";

export interface GoalAudience {
  fieldsOfStudy: string[];
  years: number[];
  cities: string[];
  universities: string[];
}

export interface GoalBudget {
  min: number | null;
  max: number | null;
  visibleToClubs: boolean;
}

export interface SponsorshipGoalSetResponse {
  id: string;
  name: string;
  companyName: string;
  objectives: string[];
  audience: GoalAudience;
  eventKinds: string[];
  budget: GoalBudget;
  notes: string | null;
  status: GoalSetStatus;
  createdAt: string;
  updatedAt: string;
}

/** Body for POST and PUT /api/sponsorship/goals. */
export interface SponsorshipGoalSetRequest {
  name: string;
  companyName: string;
  objectives: string[];
  audience: GoalAudience;
  eventKinds: string[];
  budget: GoalBudget;
  notes: string | null;
}

/** The budget clubs may see. Null on the summary or detail when hidden. */
export interface PublicBudget {
  min: number | null;
  max: number | null;
}

export interface CompanyGoalSummary {
  id: string;
  name: string;
  companyName: string;
  objectives: string[];
  eventKinds: string[];
  fieldsOfStudy: string[];
  budget: PublicBudget | null;
}

export interface CompanyGoalDetail {
  id: string;
  name: string;
  companyName: string;
  objectives: string[];
  audience: GoalAudience;
  eventKinds: string[];
  budget: PublicBudget | null;
  notes: string | null;
  updatedAt: string;
}

export interface CompanyGoalFilters {
  q?: string;
  objective?: string;
  eventKind?: string;
}

const GOALS = "/api/sponsorship/goals";
const COMPANIES = "/api/sponsorship/companies";

/** Company: all of its goal sets. */
export async function listGoalSets(
  bearerToken: string,
  signal?: AbortSignal,
): Promise<{ items: SponsorshipGoalSetResponse[] }> {
  return apiCall("GET", GOALS, { bearerToken, signal });
}

/** Company: one goal set. */
export async function getGoalSet(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<SponsorshipGoalSetResponse> {
  return apiCall("GET", `${GOALS}/${encodeURIComponent(id)}`, { bearerToken, signal });
}

/** Company: create a goal set. */
export async function createGoalSet(
  bearerToken: string,
  body: SponsorshipGoalSetRequest,
  signal?: AbortSignal,
): Promise<SponsorshipGoalSetResponse> {
  return apiCall("POST", GOALS, { bearerToken, signal, body });
}

/** Company: replace a goal set. */
export async function updateGoalSet(
  bearerToken: string,
  id: string,
  body: SponsorshipGoalSetRequest,
  signal?: AbortSignal,
): Promise<SponsorshipGoalSetResponse> {
  return apiCall("PUT", `${GOALS}/${encodeURIComponent(id)}`, {
    bearerToken,
    signal,
    body,
  });
}

/** Company: pause or resume a goal set. Paused sets are hidden from clubs. */
export async function setGoalSetStatus(
  bearerToken: string,
  id: string,
  status: GoalSetStatus,
  signal?: AbortSignal,
): Promise<SponsorshipGoalSetResponse> {
  return apiCall("POST", `${GOALS}/${encodeURIComponent(id)}/status`, {
    bearerToken,
    signal,
    body: { status },
  });
}

/** Company: delete a goal set. */
export async function deleteGoalSet(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiCall("DELETE", `${GOALS}/${encodeURIComponent(id)}`, { bearerToken, signal });
}

/** Club: active goal sets. Empty filters are left out of the URL. */
export async function listCompanyGoals(
  bearerToken: string,
  filters: CompanyGoalFilters = {},
  signal?: AbortSignal,
): Promise<{ items: CompanyGoalSummary[] }> {
  const params = new URLSearchParams();
  const q = filters.q?.trim();
  const objective = filters.objective?.trim();
  const eventKind = filters.eventKind?.trim();
  if (objective) params.set("objective", objective);
  if (eventKind) params.set("eventKind", eventKind);
  if (q) params.set("q", q);
  const qs = params.toString();
  return apiCall("GET", `${COMPANIES}${qs ? `?${qs}` : ""}`, { bearerToken, signal });
}

/** Club: one active goal set. */
export async function getCompanyGoal(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<CompanyGoalDetail> {
  return apiCall("GET", `${COMPANIES}/${encodeURIComponent(id)}`, {
    bearerToken,
    signal,
  });
}
