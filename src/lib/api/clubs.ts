import { apiCall } from "./client";
import { ApiError } from "./errors";

/**
 * STOR-69 club profile client.
 *
 * Club endpoints manage the caller's own profile; Organization endpoints
 * browse published profiles. Wire values are camelCase. Errors are
 * `ApiError` with `errorCode`:
 *   - `club_profile_not_found` (404)
 *   - `club_profile_incomplete` (400, publish, `message` names what is missing)
 *   - `club_profile_conflict` (409, save) — the profile changed elsewhere
 *     since this page loaded. Two triggers: the first-save race (two
 *     concurrent first PUTs for the same club account) and the
 *     stale-xmin update race (someone saved after we loaded). The page
 *     uses this constant to render the dedicated conflict card.
 *   - other 400 validation errors carry a readable `message`
 */

/**
 * Error code the backend returns on the first-save race and on the
 * stale-xmin update race. Surface this verbatim in the page so the
 * 409 card stays wired even if the message text changes.
 */
export const CLUB_PROFILE_CONFLICT_CODE = "club_profile_conflict" as const;

export const SUPPORT_NEEDS = [
  "Funding",
  "Venue",
  "Food and drink",
  "Prizes",
  "Speakers",
  "Equipment",
  "Promotion",
  "Volunteers",
] as const;
export type SupportNeed = (typeof SUPPORT_NEEDS)[number];

export const EVENT_FREQUENCIES = ["OneOff", "Monthly", "Termly", "Yearly"] as const;
export type EventFrequency = (typeof EVENT_FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<EventFrequency, string> = {
  OneOff: "One-off",
  Monthly: "Monthly",
  Termly: "Every term",
  Yearly: "Yearly",
};

export const STUDY_YEARS = [1, 2, 3, 4, 5, 6] as const;

export type ClubProfileStatus = "Draft" | "Published";

export interface ClubEvent {
  id: string;
  title: string;
  description: string | null;
  typicalAttendance: number;
  frequency: EventFrequency;
  supportNeeds: string[];
}

export interface ClubAudience {
  fieldsOfStudy: string[];
  years: number[];
}

export interface ClubProfileResponse {
  id: string;
  name: string;
  tagline: string | null;
  about: string;
  university: string;
  city: string | null;
  foundedYear: number | null;
  memberCount: number;
  audience: ClubAudience;
  events: ClubEvent[];
  status: ClubProfileStatus;
  updatedAt: string;
  publishedAt: string | null;
}

export interface ClubEventRequest {
  id?: string;
  title: string;
  description: string | null;
  typicalAttendance: number;
  frequency: EventFrequency;
  supportNeeds: string[];
}

/** Body for PUT /api/clubs/profile. */
export interface ClubProfileRequest {
  name: string;
  tagline: string | null;
  about: string;
  university: string;
  city: string | null;
  foundedYear: number | null;
  memberCount: number;
  audience: ClubAudience;
  events: ClubEventRequest[];
}

export interface ClubSummary {
  id: string;
  name: string;
  tagline: string | null;
  university: string;
  memberCount: number;
  fieldsOfStudy: string[];
  eventCount: number;
}

export interface ClubFilters {
  q?: string;
  field?: string;
  university?: string;
}

const PROFILE = "/api/clubs/profile";

/** Club: own profile, or null when none has been saved yet. */
export async function getMyClubProfile(
  bearerToken: string,
  signal?: AbortSignal,
): Promise<ClubProfileResponse | null> {
  try {
    return await apiCall<ClubProfileResponse>("GET", PROFILE, { bearerToken, signal });
  } catch (error) {
    if (error instanceof ApiError && error.errorCode === "club_profile_not_found") {
      return null;
    }
    throw error;
  }
}

/** Club: create or replace the profile. */
export async function saveClubProfile(
  bearerToken: string,
  body: ClubProfileRequest,
  signal?: AbortSignal,
): Promise<ClubProfileResponse> {
  return apiCall("PUT", PROFILE, { bearerToken, signal, body });
}

/** Club: make the profile visible to companies. 400 `club_profile_incomplete`. */
export async function publishClubProfile(
  bearerToken: string,
  signal?: AbortSignal,
): Promise<ClubProfileResponse> {
  return apiCall("POST", `${PROFILE}/publish`, { bearerToken, signal });
}

/** Club: hide the profile from companies again. */
export async function unpublishClubProfile(
  bearerToken: string,
  signal?: AbortSignal,
): Promise<ClubProfileResponse> {
  return apiCall("POST", `${PROFILE}/unpublish`, { bearerToken, signal });
}

/** Company: published clubs. Empty filters are left out of the URL. */
export async function listClubs(
  bearerToken: string,
  filters: ClubFilters = {},
  signal?: AbortSignal,
): Promise<{ items: ClubSummary[] }> {
  const params = new URLSearchParams();
  const q = filters.q?.trim();
  const field = filters.field?.trim();
  const university = filters.university?.trim();
  if (q) params.set("q", q);
  if (field) params.set("field", field);
  if (university) params.set("university", university);
  const qs = params.toString();
  return apiCall("GET", `/api/clubs${qs ? `?${qs}` : ""}`, { bearerToken, signal });
}

/** Company: one published club profile. */
export async function getClub(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<ClubProfileResponse> {
  return apiCall("GET", `/api/clubs/${encodeURIComponent(id)}`, {
    bearerToken,
    signal,
  });
}
