import { apiCall } from "./client";
import type { ClubSummary } from "./clubs";
import type { CompanyGoalSummary } from "./sponsorship";

/**
 * STOR-71 sponsor and club matching client.
 *
 * Fit is a word band, never a number. Both endpoints return at most 30 items,
 * best fit first. An empty `q` returns the plain suggestions. Errors are
 * `ApiError` with `errorCode`:
 *   - `sponsorship_goal_not_found` (404, company side)
 *   - `club_profile_not_found` (404, club side, no profile yet)
 *   - `club_profile_not_published` (409, club side, draft profile)
 *   - `sponsorship_match_query_invalid` (400, `q` over 200 characters)
 */

export const FIT_BANDS = ["Strong", "Good", "Partial"] as const;
export type FitBand = (typeof FIT_BANDS)[number];

/** Longest search text the server accepts. */
export const MATCH_QUERY_MAX = 200;

export interface ClubMatch {
  fit: FitBand;
  reasons: string[];
  club: ClubSummary;
}

export interface CompanyMatch {
  fit: FitBand;
  reasons: string[];
  company: CompanyGoalSummary;
}

function withQuery(path: string, q: string | undefined): string {
  const text = q?.trim();
  if (!text) return path;
  const params = new URLSearchParams();
  params.set("q", text);
  return `${path}?${params.toString()}`;
}

/** Company: clubs that fit one of its goal sets. */
export async function listClubMatches(
  bearerToken: string,
  goalId: string,
  q?: string,
  signal?: AbortSignal,
): Promise<{ items: ClubMatch[] }> {
  const path = `/api/sponsorship/goals/${encodeURIComponent(goalId)}/club-matches`;
  return apiCall("GET", withQuery(path, q), { bearerToken, signal });
}

/** Club: companies whose goals fit the caller's own published profile. */
export async function listCompanyMatches(
  bearerToken: string,
  q?: string,
  signal?: AbortSignal,
): Promise<{ items: CompanyMatch[] }> {
  return apiCall("GET", withQuery("/api/clubs/profile/company-matches", q), {
    bearerToken,
    signal,
  });
}
