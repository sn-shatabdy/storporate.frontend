import type {
  CompanyGoalDetail,
  CompanyGoalSummary,
  SponsorshipGoalSetResponse,
} from "@/lib/api/sponsorship";

export const ACCESS_TOKEN = "test-token";

export function makeGoalSet(
  overrides: Partial<SponsorshipGoalSetResponse> = {},
): SponsorshipGoalSetResponse {
  return {
    id: "goal-1",
    name: "Campus hiring",
    companyName: "Acme Ltd",
    objectives: ["Recruiting", "Brand awareness"],
    audience: {
      fieldsOfStudy: ["Computer Science", "Statistics"],
      years: [3, 4],
      cities: ["Dhaka"],
      universities: ["BUET"],
    },
    eventKinds: ["Hackathon", "Career fair"],
    budget: { min: 50000, max: 200000, visibleToClubs: true },
    notes: "We can send mentors.",
    status: "Active",
    createdAt: "2026-09-18T10:00:00Z",
    updatedAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

export function makeSummary(
  overrides: Partial<CompanyGoalSummary> = {},
): CompanyGoalSummary {
  return {
    id: "goal-1",
    name: "Campus hiring",
    companyName: "Acme Ltd",
    objectives: ["Recruiting", "Brand awareness"],
    eventKinds: ["Hackathon", "Career fair"],
    fieldsOfStudy: ["Computer Science", "Statistics", "Marketing", "Design"],
    budget: { min: 50000, max: 200000 },
    ...overrides,
  };
}

export function makeDetail(overrides: Partial<CompanyGoalDetail> = {}): CompanyGoalDetail {
  return {
    id: "goal-1",
    name: "Campus hiring",
    companyName: "Acme Ltd",
    objectives: ["Recruiting", "Brand awareness"],
    audience: {
      fieldsOfStudy: ["Computer Science"],
      years: [4, 3],
      cities: ["Dhaka"],
      universities: ["BUET"],
    },
    eventKinds: ["Hackathon"],
    budget: { min: 50000, max: 200000 },
    notes: "We can send mentors.",
    updatedAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}
