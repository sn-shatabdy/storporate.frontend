import type {
  ConversationDetail,
  ConversationMessage,
  ConversationSummary,
  ShortlistEntry,
} from "@/lib/api/outreach";

export const ACCESS_TOKEN = "test-token";

export function makeEntry(overrides: Partial<ShortlistEntry> = {}): ShortlistEntry {
  return {
    candidateId: "cand-1",
    displayName: "Nadia Rahman",
    headline: "Data student who builds dashboards",
    university: "BUET",
    fieldOfStudy: "Computer Science",
    studyYear: 3,
    available: true,
    savedAt: "2026-09-20T10:00:00Z",
    conversation: null,
    ...overrides,
  };
}

export function makeSummary(
  overrides: Partial<ConversationSummary> = {},
): ConversationSummary {
  return {
    id: "conv-1",
    counterpartName: "Nadia Rahman",
    status: "Invited",
    lastMessagePreview: "We liked your sales dashboard.",
    lastMessageAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

export function makeMessage(
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
  return {
    id: "m1",
    senderRole: "Organization",
    body: "We liked your sales dashboard.",
    createdAt: "2026-09-20T10:00:00Z",
    fromMe: true,
    ...overrides,
  };
}

export function makeDetail(
  overrides: Partial<ConversationDetail> = {},
): ConversationDetail {
  return {
    ...makeSummary(),
    messages: [makeMessage()],
    ...overrides,
  };
}
