import { ApiError } from "@/lib/api/errors";

/** Why a match request failed, in the words the pages care about. */
export type MatchFailure =
  | "goal_not_found"
  | "profile_not_found"
  | "profile_not_published"
  | "query_invalid"
  | "generic";

export function matchFailureOf(error: unknown): MatchFailure {
  if (error instanceof ApiError) {
    switch (error.errorCode) {
      case "sponsorship_goal_not_found":
        return "goal_not_found";
      case "club_profile_not_found":
        return "profile_not_found";
      case "club_profile_not_published":
        return "profile_not_published";
      case "sponsorship_match_query_invalid":
        return "query_invalid";
    }
  }
  return "generic";
}

/** One plain sentence for a match failure kind. */
export function messageForMatchFailure(failure: MatchFailure): string {
  switch (failure) {
    case "goal_not_found":
      return "This goal set could not be found. It may have been deleted.";
    case "profile_not_found":
      return "Build your club profile to see matches.";
    case "profile_not_published":
      return "Publish your profile to see matches.";
    case "query_invalid":
      return "Your search is too long. Use up to 200 characters.";
    default:
      return "Could not load matches. Check your connection and try again.";
  }
}

/** One plain sentence for a failed match request. */
export function messageForMatchingError(error: unknown): string {
  return messageForMatchFailure(matchFailureOf(error));
}

/** Reasons shown on one card. */
export const REASONS_SHOWN = 4;
