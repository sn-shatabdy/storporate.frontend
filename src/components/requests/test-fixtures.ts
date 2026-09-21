import type {
  RequestDetail,
  RequestMessage,
  RequestSummary,
} from "@/lib/api/sponsorshipRequests";

export const ACCESS_TOKEN = "test-token";

export function makeRequestSummary(overrides: Partial<RequestSummary> = {}): RequestSummary {
  return {
    id: "req-1",
    status: "Sent",
    eventTitle: "Dhaka Hack Night",
    eventDate: "2026-11-14",
    counterpartName: "Acme Ltd",
    goalName: "Campus hiring",
    amountRequested: 50000,
    createdAt: "2026-09-18T10:00:00Z",
    updatedAt: "2026-09-20T10:00:00Z",
    messageCount: 2,
    ...overrides,
  };
}

export function makeRequestMessage(overrides: Partial<RequestMessage> = {}): RequestMessage {
  return {
    id: "m-1",
    from: "Club",
    body: "We would love to have you on board.",
    createdAt: "2026-09-18T10:05:00Z",
    ...overrides,
  };
}

export function makeRequestDetail(overrides: Partial<RequestDetail> = {}): RequestDetail {
  return {
    id: "req-1",
    status: "Sent",
    eventTitle: "Dhaka Hack Night",
    eventDate: "2026-11-14",
    eventDescription: "A twelve hour hackathon for two hundred students.",
    ask: "Cash support for prizes and venue costs.",
    amountRequested: 50000,
    offer: "Logo on all banners and a recruiting booth.",
    club: { name: "BUET Coding Club", university: "BUET" },
    company: { name: "Acme Ltd", goalName: "Campus hiring" },
    createdAt: "2026-09-18T10:00:00Z",
    updatedAt: "2026-09-20T10:00:00Z",
    viewedAt: null,
    decidedAt: null,
    completedAt: null,
    decisionNote: null,
    outcome: null,
    messages: [makeRequestMessage()],
    allowedActions: ["message"],
    ...overrides,
  };
}
