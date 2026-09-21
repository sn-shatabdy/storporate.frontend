import type { ClubMatch, CompanyMatch, FitBand } from "@/lib/api/matching";
import { makeClubSummary } from "@/components/clubs/test-fixtures";
import { makeSummary } from "@/components/sponsorship/test-fixtures";

export { ACCESS_TOKEN } from "@/components/clubs/test-fixtures";

export function makeClubMatch(overrides: Partial<ClubMatch> = {}): ClubMatch {
  return {
    fit: "Strong",
    reasons: [
      "Reaches Computer Science students.",
      "Runs a yearly hackathon.",
      "Matches your words: hackathon.",
    ],
    club: makeClubSummary(),
    ...overrides,
  };
}

export function makeCompanyMatch(overrides: Partial<CompanyMatch> = {}): CompanyMatch {
  return {
    fit: "Good",
    reasons: ["Wants to reach your fields of study.", "Backs career fairs."],
    company: makeSummary(),
    ...overrides,
  };
}

export const ALL_BANDS: FitBand[] = ["Strong", "Good", "Partial"];
