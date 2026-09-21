import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";

import {
  formatAmount,
  formatDay,
  hasAction,
  inputFromValues,
  isStaleRequestError,
  messageForRequestError,
  validateCompletion,
  validateRequest,
  REQUEST_FIELD_IDS as IDS,
  type RequestFormValues,
} from "./request-helpers";

const NOW = new Date(2026, 8, 21, 12, 0, 0);

const VALID: RequestFormValues = {
  eventTitle: "Dhaka Hack Night",
  eventDate: "2026-11-14",
  eventDescription: "A twelve hour hackathon for students.",
  ask: "Cash for prizes.",
  amount: "50000",
  offer: "Logo on banners.",
};

describe("validateRequest", () => {
  it("accepts a valid form", () => {
    expect(validateRequest(VALID, NOW)).toEqual({});
  });

  it("allows a blank date and amount", () => {
    expect(validateRequest({ ...VALID, eventDate: "", amount: "" }, NOW)).toEqual({});
  });

  it("checks every length limit", () => {
    const errors = validateRequest(
      {
        ...VALID,
        eventTitle: "A",
        eventDescription: "short",
        ask: "short",
        offer: "short",
      },
      NOW,
    );
    expect(Object.keys(errors).sort()).toEqual(
      [IDS.eventTitle, IDS.eventDescription, IDS.ask, IDS.offer].sort(),
    );
    expect(validateRequest({ ...VALID, eventTitle: "x".repeat(151) }, NOW)[IDS.eventTitle]).toBeTruthy();
    expect(validateRequest({ ...VALID, eventDescription: "x".repeat(3001) }, NOW)[IDS.eventDescription]).toBeTruthy();
    expect(validateRequest({ ...VALID, ask: "x".repeat(1501) }, NOW)[IDS.ask]).toBeTruthy();
    expect(validateRequest({ ...VALID, offer: "x".repeat(1501) }, NOW)[IDS.offer]).toBeTruthy();
  });

  it("accepts yesterday and rejects earlier dates", () => {
    expect(validateRequest({ ...VALID, eventDate: "2026-09-20" }, NOW)).toEqual({});
    expect(validateRequest({ ...VALID, eventDate: "2026-09-19" }, NOW)[IDS.eventDate]).toBeTruthy();
    expect(validateRequest({ ...VALID, eventDate: "2026-02-31" }, NOW)[IDS.eventDate]).toBeTruthy();
  });

  it("checks the amount range", () => {
    expect(validateRequest({ ...VALID, amount: "0" }, NOW)).toEqual({});
    expect(validateRequest({ ...VALID, amount: "1000000000" }, NOW)).toEqual({});
    expect(validateRequest({ ...VALID, amount: "1000000001" }, NOW)[IDS.amount]).toBeTruthy();
    expect(validateRequest({ ...VALID, amount: "12.5" }, NOW)[IDS.amount]).toBeTruthy();
    expect(validateRequest({ ...VALID, amount: "-3" }, NOW)[IDS.amount]).toBeTruthy();
  });
});

describe("inputFromValues", () => {
  it("trims and turns blanks into null", () => {
    expect(
      inputFromValues("g1", { ...VALID, eventTitle: " Hack ", eventDate: "", amount: "" }),
    ).toEqual({
      goalId: "g1",
      eventTitle: "Hack",
      eventDate: null,
      eventDescription: VALID.eventDescription,
      ask: VALID.ask,
      amountRequested: null,
      offer: VALID.offer,
    });
  });
});

describe("validateCompletion", () => {
  it("requires a note and checks the amount", () => {
    expect(validateCompletion("", "").note).toBeTruthy();
    expect(validateCompletion("x".repeat(1001), "").note).toBeTruthy();
    expect(validateCompletion("Done", "abc").amount).toBeTruthy();
    expect(validateCompletion("Done", "")).toEqual({});
    expect(validateCompletion("Done", "500")).toEqual({});
  });
});

describe("messageForRequestError", () => {
  const err = (code: string, status: number, message = "Server message.") =>
    new ApiError(code, message, status);

  it("maps each known code to a plain sentence", () => {
    const codes = [
      "sponsorship_request_not_found",
      "club_profile_not_found",
      "club_profile_not_published",
      "sponsorship_goal_not_found",
      "sponsorship_request_duplicate",
      "sponsorship_request_closed",
      "sponsorship_request_thread_full",
      "sponsorship_request_invalid_transition",
      "sponsorship_request_status_invalid",
    ];
    const seen = new Set<string>();
    for (const code of codes) {
      const text = messageForRequestError(err(code, 409), "create");
      expect(text).not.toBe("Server message.");
      expect(text).not.toMatch(/[—–]/);
      seen.add(text);
    }
    expect(seen.size).toBe(codes.length);
  });

  it("shows the server message for other 400 request codes", () => {
    expect(
      messageForRequestError(err("sponsorship_request_event_title_invalid", 400), "create"),
    ).toBe("Server message.");
  });

  it("falls back per action for unknown errors", () => {
    expect(messageForRequestError(new Error("x"), "message")).toMatch(/message/);
    expect(messageForRequestError(err("boom", 500), "accept")).toMatch(/accept/);
    expect(messageForRequestError(err("boom", 500), "decline")).toMatch(/decline/);
    expect(messageForRequestError(err("boom", 500), "complete")).toMatch(/completed/);
    expect(messageForRequestError(err("boom", 500), "load")).toMatch(/load/);
  });

  it("flags stale conflicts", () => {
    expect(isStaleRequestError(err("sponsorship_request_closed", 409))).toBe(true);
    expect(isStaleRequestError(err("sponsorship_request_duplicate", 409))).toBe(false);
    expect(isStaleRequestError(new Error("x"))).toBe(false);
  });
});

describe("formatting", () => {
  it("formats amounts in BDT", () => {
    expect(formatAmount(50000)).toBe("BDT 50,000");
    expect(formatAmount(0)).toBe("BDT 0");
    expect(formatAmount(null)).toBeNull();
  });

  it("formats dates without a timezone shift", () => {
    expect(formatDay("2026-11-14")).toBe("Nov 14, 2026");
    expect(formatDay(null)).toBe("");
    expect(formatDay("nope")).toBe("");
  });

  it("reads allowed actions", () => {
    expect(hasAction(["message", "complete"], "complete")).toBe(true);
    expect(hasAction(["message"], "accept")).toBe(false);
    expect(hasAction(undefined, "message")).toBe(false);
  });
});
