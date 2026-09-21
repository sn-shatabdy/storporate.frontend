import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";

import {
  addCities,
  addFieldsOfStudy,
  EMPTY_GOAL_VALUES,
  FIELD_IDS,
  formatBudget,
  formatPublicBudget,
  mergeDrafts,
  messageForSponsorshipError,
  requestFromValues,
  validateGoal,
  valuesFromGoalSet,
  yearsText,
  type GoalFormValues,
} from "./sponsorship-helpers";
import { makeGoalSet } from "./test-fixtures";

function valid(overrides: Partial<GoalFormValues> = {}): GoalFormValues {
  return {
    ...EMPTY_GOAL_VALUES,
    name: "Campus hiring",
    companyName: "Acme Ltd",
    objectives: ["Recruiting"],
    fieldsOfStudy: ["Computer Science"],
    eventKinds: ["Hackathon"],
    ...overrides,
  };
}

describe("formatBudget", () => {
  it("formats a full range with thousands separators", () => {
    expect(formatBudget(50000, 200000)).toBe("BDT 50,000 to BDT 200,000");
    expect(formatBudget(1000000, 25000000)).toBe("BDT 1,000,000 to BDT 25,000,000");
  });

  it("formats one sided budgets", () => {
    expect(formatBudget(50000, null)).toBe("From BDT 50,000");
    expect(formatBudget(null, 200000)).toBe("Up to BDT 200,000");
  });

  it("shows one amount when both are equal", () => {
    expect(formatBudget(75000, 75000)).toBe("BDT 75,000");
  });

  it("keeps zero as an amount", () => {
    expect(formatBudget(0, 5000)).toBe("BDT 0 to BDT 5,000");
  });

  it("returns null when nothing is set", () => {
    expect(formatBudget(null, null)).toBeNull();
    expect(formatBudget(undefined, undefined)).toBeNull();
  });

  it("never uses dashes or a currency symbol", () => {
    const text = formatBudget(1, 2) ?? "";
    expect(text).not.toMatch(/[—–-]/);
    expect(text).not.toMatch(/[৳$]/);
  });

  it("formatPublicBudget handles a hidden budget", () => {
    expect(formatPublicBudget(null)).toBeNull();
    expect(formatPublicBudget({ min: null, max: null })).toBeNull();
    expect(formatPublicBudget({ min: 1000, max: null })).toBe("From BDT 1,000");
  });
});

describe("yearsText", () => {
  it("sorts and labels years", () => {
    expect(yearsText([4, 2])).toBe("Year 2, Year 4");
  });
});

describe("validateGoal", () => {
  it("accepts a valid set", () => {
    expect(validateGoal(valid())).toEqual({});
  });

  it("flags name and company length", () => {
    const errors = validateGoal(valid({ name: "a", companyName: " " }));
    expect(errors[FIELD_IDS.name]).toMatch(/2 to 100/);
    expect(errors[FIELD_IDS.companyName]).toMatch(/2 to 150/);
  });

  it("needs one to six objectives and at least one event kind", () => {
    expect(validateGoal(valid({ objectives: [] }))[FIELD_IDS.objectives]).toBeTruthy();
    expect(
      validateGoal(
        valid({ objectives: ["a", "b", "c", "d", "e", "f", "g"] }),
      )[FIELD_IDS.objectives],
    ).toMatch(/at most 6/);
    expect(validateGoal(valid({ eventKinds: [] }))[FIELD_IDS.eventKinds]).toBeTruthy();
  });

  it("requires at least one audience dimension", () => {
    const empty = validateGoal(valid({ fieldsOfStudy: [] }));
    expect(empty[FIELD_IDS.audience]).toBe(
      "Add at least one field of study, year, city or university.",
    );
    expect(validateGoal(valid({ fieldsOfStudy: [], years: [2] }))[FIELD_IDS.audience]).toBeUndefined();
    expect(validateGoal(valid({ fieldsOfStudy: [], cities: ["Dhaka"] }))[FIELD_IDS.audience]).toBeUndefined();
    expect(validateGoal(valid({ fieldsOfStudy: [], universities: ["BUET"] }))[FIELD_IDS.audience]).toBeUndefined();
  });

  it("checks budget bounds and order", () => {
    expect(validateGoal(valid({ budgetMin: "-5" }))[FIELD_IDS.budgetMin]).toBeTruthy();
    expect(validateGoal(valid({ budgetMax: "1000000001" }))[FIELD_IDS.budgetMax]).toBeTruthy();
    expect(validateGoal(valid({ budgetMax: "abc" }))[FIELD_IDS.budgetMax]).toBeTruthy();
    expect(
      validateGoal(valid({ budgetMin: "200", budgetMax: "100" }))[FIELD_IDS.budgetMax],
    ).toMatch(/at least the minimum/);
    expect(validateGoal(valid({ budgetMin: "100", budgetMax: "100" }))).toEqual({});
    expect(validateGoal(valid({ budgetMin: "0", budgetMax: "1000000000" }))).toEqual({});
  });

  it("limits notes to 1000 characters", () => {
    expect(validateGoal(valid({ notes: "x".repeat(1001) }))[FIELD_IDS.notes]).toBeTruthy();
    expect(validateGoal(valid({ notes: "x".repeat(1000) }))[FIELD_IDS.notes]).toBeUndefined();
  });

  it("uses no dashes in its messages", () => {
    const all = Object.values(
      validateGoal({
        ...EMPTY_GOAL_VALUES,
        budgetMin: "9",
        budgetMax: "1",
        notes: "x".repeat(1001),
      }),
    ).join(" ");
    expect(all).not.toMatch(/[—–]/);
    expect(all).not.toMatch(/evidence|proof|score|%/i);
  });
});

describe("tag adders", () => {
  it("dedupes ignoring case and splits commas", () => {
    const result = addFieldsOfStudy(["Marketing"], "marketing, Design ,");
    expect(result.skills).toEqual(["Marketing", "Design"]);
    expect(result.error).toBeNull();
  });

  it("reports a length error", () => {
    expect(addCities([], "x").error).toBe("Each city needs 2 to 60 characters.");
  });

  it("stops at the limit", () => {
    const ten = Array.from({ length: 10 }, (_, i) => `City ${i}`);
    const result = addCities(ten, "Eleven");
    expect(result.skills).toHaveLength(10);
    expect(result.error).toBe("You can add up to 10 cities.");
  });

  it("mergeDrafts takes half typed text along", () => {
    const merged = mergeDrafts(valid(), { fields: "Design", cities: "Dhaka", universities: "" });
    expect(merged.fieldsOfStudy).toEqual(["Computer Science", "Design"]);
    expect(merged.cities).toEqual(["Dhaka"]);
  });
});

describe("request and values mapping", () => {
  it("builds the body with null budget and notes when empty", () => {
    const body = requestFromValues(valid({ years: [4, 2], notes: "  " }));
    expect(body).toEqual({
      name: "Campus hiring",
      companyName: "Acme Ltd",
      objectives: ["Recruiting"],
      audience: { fieldsOfStudy: ["Computer Science"], years: [2, 4], cities: [], universities: [] },
      eventKinds: ["Hackathon"],
      budget: { min: null, max: null, visibleToClubs: false },
      notes: null,
    });
  });

  it("round trips a response through the form values", () => {
    const goal = makeGoalSet();
    const body = requestFromValues(valuesFromGoalSet(goal));
    expect(body.budget).toEqual({ min: 50000, max: 200000, visibleToClubs: true });
    expect(body.notes).toBe("We can send mentors.");
    expect(body.audience.years).toEqual([3, 4]);
  });
});

describe("messageForSponsorshipError", () => {
  it("maps known codes and shows server messages for 400s", () => {
    expect(
      messageForSponsorshipError(new ApiError("sponsorship_goal_not_found", "x", 404), "save"),
    ).toMatch(/could not be found/);
    expect(
      messageForSponsorshipError(
        new ApiError("sponsorship_goal_audience_required", "raw", 400),
        "save",
      ),
    ).toMatch(/at least one field of study/);
    expect(
      messageForSponsorshipError(new ApiError("sponsorship_goal_name_invalid", "Name is bad.", 400), "save"),
    ).toBe("Name is bad.");
  });

  it("falls back to a plain sentence per action", () => {
    expect(messageForSponsorshipError(new Error("x"), "save")).toMatch(/Could not save/);
    expect(messageForSponsorshipError(new Error("x"), "status")).toMatch(/Could not update/);
    expect(messageForSponsorshipError(new Error("x"), "delete")).toMatch(/Could not delete/);
  });
});
