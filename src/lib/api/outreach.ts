import { apiCall } from "./client";

/**
 * STOR-68 shortlist and outreach client.
 *
 * Employers save students to a shortlist and send an invitation message.
 * The student replies or declines. Contact details are never part of any
 * payload. Wire values are camelCase. Errors are `ApiError` with `errorCode`:
 *   - `candidate_not_found` (404)
 *   - `outreach_not_found` (404)
 *   - `outreach_organization_name_invalid` (400, 2 to 150 characters)
 *   - `outreach_message_invalid` (400, 1 to 2000 characters)
 *   - `outreach_already_started` (409)
 *   - `outreach_declined` (409)
 *   - `outreach_awaiting_reply` (409, employer writes while Invited)
 */

export type ConversationStatus = "Invited" | "Replied" | "Declined";

export interface ShortlistConversationRef {
  id: string;
  status: ConversationStatus;
}

/** When `available` is false the student opted out and every other detail
 *  field is null. */
export interface ShortlistEntry {
  candidateId: string;
  displayName: string | null;
  headline: string | null;
  university: string | null;
  fieldOfStudy: string | null;
  studyYear: number | null;
  available: boolean;
  savedAt: string;
  conversation: ShortlistConversationRef | null;
}

export interface ConversationSummary {
  id: string;
  /** The student's name for employers, the organization for students. */
  counterpartName: string;
  status: ConversationStatus;
  lastMessagePreview: string;
  lastMessageAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  senderRole: "Organization" | "Student";
  body: string;
  createdAt: string;
  fromMe: boolean;
}

export interface ConversationDetail extends ConversationSummary {
  /** Oldest first. */
  messages: ConversationMessage[];
}

export const OUTREACH_ORGANIZATION_MIN = 2;
export const OUTREACH_ORGANIZATION_MAX = 150;
export const OUTREACH_MESSAGE_MAX = 2000;

const SHORTLIST = "/api/discovery/shortlist";
const OUTREACH = "/api/discovery/outreach";
const INBOX = "/api/discovery/inbox";

/** Employer: save a student to the shortlist. */
export async function addToShortlist(
  bearerToken: string,
  candidateId: string,
  signal?: AbortSignal,
): Promise<ShortlistEntry> {
  return apiCall("POST", SHORTLIST, {
    bearerToken,
    signal,
    body: { candidateId },
  });
}

/** Employer: everyone on the shortlist. */
export async function listShortlist(
  bearerToken: string,
  signal?: AbortSignal,
): Promise<{ items: ShortlistEntry[] }> {
  return apiCall("GET", SHORTLIST, { bearerToken, signal });
}

/** Employer: take a student off the shortlist. */
export async function removeFromShortlist(
  bearerToken: string,
  candidateId: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiCall("DELETE", `${SHORTLIST}/${encodeURIComponent(candidateId)}`, {
    bearerToken,
    signal,
  });
}

/** Employer: send the first message to a student. */
export async function startOutreach(
  bearerToken: string,
  input: { candidateId: string; organizationName: string; message: string },
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  return apiCall("POST", OUTREACH, {
    bearerToken,
    signal,
    body: {
      candidateId: input.candidateId,
      organizationName: input.organizationName.trim(),
      message: input.message.trim(),
    },
  });
}

/** Employer: every conversation the organization started. */
export async function listMyOutreach(
  bearerToken: string,
  signal?: AbortSignal,
): Promise<{ items: ConversationSummary[] }> {
  return apiCall("GET", OUTREACH, { bearerToken, signal });
}

/** Employer: one conversation with its messages. */
export async function getOutreach(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  return apiCall("GET", `${OUTREACH}/${encodeURIComponent(id)}`, {
    bearerToken,
    signal,
  });
}

/** Employer: send a follow-up message after the student replied. */
export async function sendOutreachMessage(
  bearerToken: string,
  id: string,
  message: string,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  return apiCall("POST", `${OUTREACH}/${encodeURIComponent(id)}/messages`, {
    bearerToken,
    signal,
    body: { message: message.trim() },
  });
}

/** Student: every invitation and conversation. */
export async function listInbox(
  bearerToken: string,
  signal?: AbortSignal,
): Promise<{ items: ConversationSummary[] }> {
  return apiCall("GET", INBOX, { bearerToken, signal });
}

/** Student: one conversation with its messages. */
export async function getInboxConversation(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  return apiCall("GET", `${INBOX}/${encodeURIComponent(id)}`, {
    bearerToken,
    signal,
  });
}

/** Student: answer an invitation or keep the conversation going. */
export async function replyToInvitation(
  bearerToken: string,
  id: string,
  message: string,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  return apiCall("POST", `${INBOX}/${encodeURIComponent(id)}/reply`, {
    bearerToken,
    signal,
    body: { message: message.trim() },
  });
}

/** Student: decline an invitation. Final. */
export async function declineInvitation(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<ConversationDetail> {
  return apiCall("POST", `${INBOX}/${encodeURIComponent(id)}/decline`, {
    bearerToken,
    signal,
  });
}
