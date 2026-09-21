import type {
  ClubEvent,
  ClubProfileResponse,
  ClubSummary,
} from "@/lib/api/clubs";

export const ACCESS_TOKEN = "test-token";

export function makeEvent(overrides: Partial<ClubEvent> = {}): ClubEvent {
  return {
    id: "ev-1",
    title: "Data Night",
    description: "A monthly evening of talks and demos.",
    typicalAttendance: 80,
    frequency: "Monthly",
    supportNeeds: ["Venue", "Food and drink"],
    ...overrides,
  };
}

export function makeClubProfile(
  overrides: Partial<ClubProfileResponse> = {},
): ClubProfileResponse {
  return {
    id: "club-1",
    name: "Data Science Club",
    tagline: "Learn by building",
    about: "We run weekly data sessions and a yearly hackathon for students.",
    university: "BUET",
    city: "Dhaka",
    foundedYear: 2018,
    memberCount: 120,
    audience: { fieldsOfStudy: ["Computer Science", "Statistics"], years: [1, 2, 3] },
    events: [makeEvent()],
    status: "Draft",
    updatedAt: "2026-09-20T10:00:00Z",
    publishedAt: null,
    ...overrides,
  };
}

export function makeClubSummary(overrides: Partial<ClubSummary> = {}): ClubSummary {
  return {
    id: "club-1",
    name: "Data Science Club",
    tagline: "Learn by building",
    university: "BUET",
    memberCount: 120,
    fieldsOfStudy: ["Computer Science", "Statistics"],
    eventCount: 3,
    ...overrides,
  };
}
