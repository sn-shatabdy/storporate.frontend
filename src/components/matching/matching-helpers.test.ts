import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";

import { matchFailureOf, messageForMatchingError } from "./matching-helpers";

describe("messageForMatchingError", () => {
  it("maps each known code to a plain sentence", () => {
    const cases: [string, number, string, string][] = [
      ["sponsorship_goal_not_found", 404, "goal_not_found", "This goal set could not be found. It may have been deleted."],
      ["club_profile_not_found", 404, "profile_not_found", "Build your club profile to see matches."],
      ["club_profile_not_published", 409, "profile_not_published", "Publish your profile to see matches."],
      ["sponsorship_match_query_invalid", 400, "query_invalid", "Your search is too long. Use up to 200 characters."],
    ];
    for (const [code, status, failure, message] of cases) {
      const error = new ApiError(code, "server text", status);
      expect(matchFailureOf(error)).toBe(failure);
      expect(messageForMatchingError(error)).toBe(message);
    }
  });

  it("falls back for unknown and non API errors", () => {
    expect(matchFailureOf(new Error("x"))).toBe("generic");
    expect(messageForMatchingError(new ApiError("boom", "x", 500))).toBe(
      "Could not load matches. Check your connection and try again.",
    );
  });
});
