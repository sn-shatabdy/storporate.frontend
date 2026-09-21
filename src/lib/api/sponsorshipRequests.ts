import { apiCall } from "./client";

/**
 * STOR-72 sponsorship requests client.
 *
 * A club sends a request for one event to one of a company's goal sets. The
 * company accepts, declines or asks questions, and either side can mark an
 * agreed request completed. Wire values are camelCase, timestamps are ISO and
 * dates are `yyyy-MM-dd`. Errors are `ApiError` with `errorCode`:
 *   - `sponsorship_request_not_found` (404)
 *   - `club_profile_not_found` (404)
 *   - `club_profile_not_published` (409)
 *   - `sponsorship_goal_not_found` (404, goal missing or paused)
 *   - `sponsorship_request_duplicate` (409, an open request exists)
 *   - `sponsorship_request_closed` (409)
 *   - `sponsorship_request_thread_full` (409)
 *   - `sponsorship_request_invalid_transition` (409)
 *   - `sponsorship_request_status_invalid` (400)
 *   - other 400 errors are prefixed `sponsorship_request_` and carry a
 *     readable `message`
 */

export const REQUEST_STATUSES = [
  "Sent",
  "Viewed",
  "InDiscussion",
  "Agreed",
  "Declined",
  "Completed",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** What the server says the caller may do on one request. */
export type RequestAction = "message" | "accept" | "decline" | "complete";

export const REQUEST_LIMITS = {
  eventTitleMin: 2,
  eventTitleMax: 150,
  eventDescriptionMin: 20,
  eventDescriptionMax: 3000,
  askMin: 10,
  askMax: 1500,
  offerMin: 10,
  offerMax: 1500,
  amountMax: 1_000_000_000,
  messageMax: 2000,
  noteMax: 1000,
  outcomeNoteMax: 1000,
} as const;

export interface RequestSummary {
  id: string;
  status: RequestStatus;
  eventTitle: string;
  eventDate: string | null;
  /** The company name for clubs, the club name for companies. */
  counterpartName: string;
  goalName: string;
  amountRequested: number | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface RequestMessage {
  id: string;
  from: "Club" | "Company";
  body: string;
  createdAt: string;
}

export interface RequestOutcome {
  note: string;
  agreedAmount: number | null;
}

export interface RequestDetail {
  id: string;
  status: RequestStatus;
  eventTitle: string;
  eventDate: string | null;
  eventDescription: string;
  ask: string;
  amountRequested: number | null;
  offer: string;
  club: { name: string; university: string };
  company: { name: string; goalName: string };
  createdAt: string;
  updatedAt: string;
  viewedAt: string | null;
  decidedAt: string | null;
  completedAt: string | null;
  decisionNote: string | null;
  outcome: RequestOutcome | null;
  /** Oldest first. */
  messages: RequestMessage[];
  /** Every button on the screen comes from this list. */
  allowedActions: string[];
}

/** Body for POST /api/sponsorship/requests. */
export interface CreateRequestInput {
  goalId: string;
  eventTitle: string;
  eventDate: string | null;
  eventDescription: string;
  ask: string;
  amountRequested: number | null;
  offer: string;
}

export interface CompleteRequestInput {
  outcomeNote: string;
  agreedAmount: number | null;
}

const BASE = "/api/sponsorship/requests";
const SENT = `${BASE}/sent`;
const RECEIVED = `${BASE}/received`;

function withStatus(path: string, status?: RequestStatus | null): string {
  if (!status) return path;
  return `${path}?${new URLSearchParams({ status }).toString()}`;
}

function idPath(base: string, id: string): string {
  return `${base}/${encodeURIComponent(id)}`;
}

/** Club: send a request. */
export async function createRequest(
  bearerToken: string,
  input: CreateRequestInput,
  signal?: AbortSignal,
): Promise<RequestDetail> {
  return apiCall("POST", BASE, {
    bearerToken,
    signal,
    body: {
      goalId: input.goalId,
      eventTitle: input.eventTitle.trim(),
      eventDate: input.eventDate,
      eventDescription: input.eventDescription.trim(),
      ask: input.ask.trim(),
      amountRequested: input.amountRequested,
      offer: input.offer.trim(),
    },
  });
}

/** Club: requests the club sent, optionally filtered by status. */
export async function listSentRequests(
  bearerToken: string,
  status?: RequestStatus | null,
  signal?: AbortSignal,
): Promise<{ items: RequestSummary[] }> {
  return apiCall("GET", withStatus(SENT, status), { bearerToken, signal });
}

/** Club: one sent request. */
export async function getSentRequest(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<RequestDetail> {
  return apiCall("GET", idPath(SENT, id), { bearerToken, signal });
}

/** Club: add a message to a sent request. */
export async function sendSentRequestMessage(
  bearerToken: string,
  id: string,
  body: string,
  signal?: AbortSignal,
): Promise<RequestDetail> {
  return apiCall("POST", `${idPath(SENT, id)}/messages`, {
    bearerToken,
    signal,
    body: { body: body.trim() },
  });
}

/** Club: mark an agreed request completed. */
export async function completeSentRequest(
  bearerToken: string,
  id: string,
  input: CompleteRequestInput,
  signal?: AbortSignal,
): Promise<RequestDetail> {
  return apiCall("POST", `${idPath(SENT, id)}/complete`, {
    bearerToken,
    signal,
    body: { outcomeNote: input.outcomeNote.trim(), agreedAmount: input.agreedAmount },
  });
}

/** Company: requests received, optionally filtered by status. */
export async function listReceivedRequests(
  bearerToken: string,
  status?: RequestStatus | null,
  signal?: AbortSignal,
): Promise<{ items: RequestSummary[] }> {
  return apiCall("GET", withStatus(RECEIVED, status), { bearerToken, signal });
}

/** Company: one received request. Opening it marks a Sent request Viewed. */
export async function getReceivedRequest(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<RequestDetail> {
  return apiCall("GET", idPath(RECEIVED, id), { bearerToken, signal });
}

/** Company: add a message, such as a question, to a received request. */
export async function sendReceivedRequestMessage(
  bearerToken: string,
  id: string,
  body: string,
  signal?: AbortSignal,
): Promise<RequestDetail> {
  return apiCall("POST", `${idPath(RECEIVED, id)}/messages`, {
    bearerToken,
    signal,
    body: { body: body.trim() },
  });
}

/** Company: accept a request with an optional note. */
export async function acceptRequest(
  bearerToken: string,
  id: string,
  note: string,
  signal?: AbortSignal,
): Promise<RequestDetail> {
  return apiCall("POST", `${idPath(RECEIVED, id)}/accept`, {
    bearerToken,
    signal,
    body: { note: note.trim() },
  });
}

/** Company: decline a request with an optional reason. */
export async function declineRequest(
  bearerToken: string,
  id: string,
  reason: string,
  signal?: AbortSignal,
): Promise<RequestDetail> {
  return apiCall("POST", `${idPath(RECEIVED, id)}/decline`, {
    bearerToken,
    signal,
    body: { reason: reason.trim() },
  });
}

/** Company: mark an agreed request completed. */
export async function completeReceivedRequest(
  bearerToken: string,
  id: string,
  input: CompleteRequestInput,
  signal?: AbortSignal,
): Promise<RequestDetail> {
  return apiCall("POST", `${idPath(RECEIVED, id)}/complete`, {
    bearerToken,
    signal,
    body: { outcomeNote: input.outcomeNote.trim(), agreedAmount: input.agreedAmount },
  });
}
