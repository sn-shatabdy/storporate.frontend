import { ApiError } from "@/lib/api/errors";
import {
  REQUEST_LIMITS,
  type CreateRequestInput,
  type RequestStatus,
} from "@/lib/api/sponsorshipRequests";
import { formatBudget } from "@/components/sponsorship/sponsorship-helpers";

export const STATUS_LABELS: Record<RequestStatus, string> = {
  Sent: "Sent",
  Viewed: "Viewed",
  InDiscussion: "In discussion",
  Agreed: "Agreed",
  Declined: "Declined",
  Completed: "Completed",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as RequestStatus] ?? status;
}

/** The status filter chips, in screen order. `null` means All. */
export const STATUS_FILTERS: { value: RequestStatus | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "Sent", label: "Sent" },
  { value: "Viewed", label: "Viewed" },
  { value: "InDiscussion", label: "In discussion" },
  { value: "Agreed", label: "Agreed" },
  { value: "Declined", label: "Declined" },
  { value: "Completed", label: "Completed" },
];

/** "BDT 50,000", or null when there is no amount. */
export function formatAmount(amount: number | null | undefined): string | null {
  return formatBudget(amount, amount);
}

/** "Sep 20, 2026" for an ISO timestamp or a `yyyy-MM-dd` date. Empty for bad input. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function hasAction(allowed: readonly string[] | undefined, action: string): boolean {
  return Array.isArray(allowed) && allowed.includes(action);
}

export function messageCountText(count: number): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? "message" : "messages"}`;
}

// ---------------------------------------------------------------- errors

export type RequestErrorAction = "create" | "message" | "accept" | "decline" | "complete" | "load";

const FALLBACKS: Record<RequestErrorAction, string> = {
  create: "Could not send the request. Check your connection and try again.",
  message: "Could not send your message. Try again.",
  accept: "Could not accept this request. Try again.",
  decline: "Could not decline this request. Try again.",
  complete: "Could not mark this request as completed. Try again.",
  load: "Could not load this request. Check your connection and try again.",
};

/** One plain sentence for a failed request call. */
export function messageForRequestError(
  error: unknown,
  action: RequestErrorAction = "load",
): string {
  if (error instanceof ApiError) {
    switch (error.errorCode) {
      case "sponsorship_request_not_found":
        return "This request could not be found.";
      case "club_profile_not_found":
        return "Create your club profile before you send a request.";
      case "club_profile_not_published":
        return "Publish your club profile before you send a request.";
      case "sponsorship_goal_not_found":
        return "This goal set is not available. The company may have paused or removed it.";
      case "sponsorship_request_duplicate":
        return "You already have an open request for this goal and event title.";
      case "sponsorship_request_closed":
        return "This request is closed. It cannot be changed.";
      case "sponsorship_request_thread_full":
        return "This conversation has reached its message limit.";
      case "sponsorship_request_invalid_transition":
        return "This request cannot move to that step from where it is now.";
      case "sponsorship_request_status_invalid":
        return "That status filter is not valid.";
      default:
        if (
          error.status === 400 &&
          error.errorCode.startsWith("sponsorship_request_") &&
          error.message
        ) {
          return error.message;
        }
    }
  }
  return FALLBACKS[action];
}

/** True when the request changed on the server and the screen should reload it. */
export function isStaleRequestError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.errorCode === "sponsorship_request_closed" ||
      error.errorCode === "sponsorship_request_invalid_transition" ||
      error.errorCode === "sponsorship_request_thread_full")
  );
}

// ------------------------------------------------------------------ form

export interface RequestFormValues {
  eventTitle: string;
  eventDate: string;
  eventDescription: string;
  ask: string;
  amount: string;
  offer: string;
}

export const EMPTY_REQUEST_VALUES: RequestFormValues = {
  eventTitle: "",
  eventDate: "",
  eventDescription: "",
  ask: "",
  amount: "",
  offer: "",
};

export const REQUEST_FIELD_IDS = {
  eventTitle: "request-event-title",
  eventDate: "request-event-date",
  eventDescription: "request-event-description",
  ask: "request-ask",
  amount: "request-amount",
  offer: "request-offer",
} as const;

/** Field order on screen, used to focus the first invalid field. */
export const REQUEST_ERROR_ORDER: string[] = [
  REQUEST_FIELD_IDS.eventTitle,
  REQUEST_FIELD_IDS.eventDate,
  REQUEST_FIELD_IDS.eventDescription,
  REQUEST_FIELD_IDS.ask,
  REQUEST_FIELD_IDS.offer,
  REQUEST_FIELD_IDS.amount,
];

export type RequestFormErrors = Record<string, string>;

const AMOUNT_ERROR = `Enter a whole amount from 0 to ${REQUEST_LIMITS.amountMax.toLocaleString("en-US")}.`;

export function parseAmount(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= REQUEST_LIMITS.amountMax ? n : null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar date as `yyyy-MM-dd`, `daysFromNow` days away. */
export function isoDate(now: Date, daysFromNow = 0): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysFromNow);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isRealDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

function lengthError(label: string, min: number, max: number): string {
  return `${label} needs ${min} to ${max.toLocaleString("en-US")} characters.`;
}

export function validateRequest(
  v: RequestFormValues,
  now: Date = new Date(),
): RequestFormErrors {
  const errors: RequestFormErrors = {};
  const L = REQUEST_LIMITS;

  const title = v.eventTitle.trim().length;
  if (title < L.eventTitleMin || title > L.eventTitleMax) {
    errors[REQUEST_FIELD_IDS.eventTitle] = lengthError("The event title", L.eventTitleMin, L.eventTitleMax);
  }

  const date = v.eventDate.trim();
  if (date) {
    if (!isRealDate(date)) {
      errors[REQUEST_FIELD_IDS.eventDate] = "Enter a valid date.";
    } else if (date < isoDate(now, -1)) {
      errors[REQUEST_FIELD_IDS.eventDate] = "Pick a date that is not in the past.";
    }
  }

  const desc = v.eventDescription.trim().length;
  if (desc < L.eventDescriptionMin || desc > L.eventDescriptionMax) {
    errors[REQUEST_FIELD_IDS.eventDescription] = lengthError(
      "The event description",
      L.eventDescriptionMin,
      L.eventDescriptionMax,
    );
  }

  const ask = v.ask.trim().length;
  if (ask < L.askMin || ask > L.askMax) {
    errors[REQUEST_FIELD_IDS.ask] = lengthError("What you are asking for", L.askMin, L.askMax);
  }

  const offer = v.offer.trim().length;
  if (offer < L.offerMin || offer > L.offerMax) {
    errors[REQUEST_FIELD_IDS.offer] = lengthError(
      "What the company gets in return",
      L.offerMin,
      L.offerMax,
    );
  }

  if (v.amount.trim() && parseAmount(v.amount) === null) {
    errors[REQUEST_FIELD_IDS.amount] = AMOUNT_ERROR;
  }
  return errors;
}

/** Convert form values into the POST body. Assumes the values validated. */
export function inputFromValues(goalId: string, v: RequestFormValues): CreateRequestInput {
  const date = v.eventDate.trim();
  return {
    goalId,
    eventTitle: v.eventTitle.trim(),
    eventDate: date ? date : null,
    eventDescription: v.eventDescription.trim(),
    ask: v.ask.trim(),
    amountRequested: parseAmount(v.amount),
    offer: v.offer.trim(),
  };
}

// -------------------------------------------------------------- dialogs

/** Validate the "mark as completed" fields. Returns per-field errors. */
export function validateCompletion(
  note: string,
  amount: string,
): { note?: string; amount?: string } {
  const errors: { note?: string; amount?: string } = {};
  const n = note.trim().length;
  if (n < 1) errors.note = "Write a short outcome note.";
  else if (n > REQUEST_LIMITS.outcomeNoteMax) {
    errors.note = `Use ${REQUEST_LIMITS.outcomeNoteMax.toLocaleString("en-US")} characters or fewer.`;
  }
  if (amount.trim() && parseAmount(amount) === null) errors.amount = AMOUNT_ERROR;
  return errors;
}
