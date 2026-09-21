import { ApiError } from "@/lib/api/errors";
import {
  type GoalSetStatus,
  type PublicBudget,
  type SponsorshipGoalSetRequest,
  type SponsorshipGoalSetResponse,
} from "@/lib/api/sponsorship";

export const LIMITS = {
  nameMin: 2,
  nameMax: 100,
  companyMin: 2,
  companyMax: 150,
  objectivesMax: 6,
  fieldsMax: 15,
  fieldMin: 2,
  fieldMax: 60,
  citiesMax: 10,
  cityMin: 2,
  cityMax: 60,
  universitiesMax: 10,
  universityMin: 2,
  universityMax: 150,
  eventKindsMax: 8,
  budgetMax: 1_000_000_000,
  notesMax: 1000,
} as const;

export interface GoalFormValues {
  name: string;
  companyName: string;
  objectives: string[];
  fieldsOfStudy: string[];
  years: number[];
  cities: string[];
  universities: string[];
  eventKinds: string[];
  budgetMin: string;
  budgetMax: string;
  visibleToClubs: boolean;
  notes: string;
}

/** The half typed text in each tag box. */
export interface GoalDrafts {
  fields: string;
  cities: string;
  universities: string;
}

export const EMPTY_DRAFTS: GoalDrafts = { fields: "", cities: "", universities: "" };

/** Error messages keyed by the DOM id of the field they belong to. */
export type GoalErrors = Record<string, string>;

export const EMPTY_GOAL_VALUES: GoalFormValues = {
  name: "",
  companyName: "",
  objectives: [],
  fieldsOfStudy: [],
  years: [],
  cities: [],
  universities: [],
  eventKinds: [],
  budgetMin: "",
  budgetMax: "",
  visibleToClubs: false,
  notes: "",
};

export const FIELD_IDS = {
  name: "goal-name",
  companyName: "goal-company",
  objectives: "goal-objective-0",
  fieldsOfStudy: "goal-fields",
  years: "goal-year-1",
  cities: "goal-cities",
  universities: "goal-universities",
  audience: "goal-audience",
  eventKinds: "goal-event-kind-0",
  budgetMin: "goal-budget-min",
  budgetMax: "goal-budget-max",
  notes: "goal-notes",
} as const;

/** Where focus goes for each error key. The audience error points at the
 *  first audience box. */
export const FOCUS_TARGET: Record<string, string> = {
  [FIELD_IDS.audience]: FIELD_IDS.fieldsOfStudy,
};

/** Field order on screen, used to focus the first invalid field. */
export const ERROR_ORDER: string[] = [
  FIELD_IDS.name,
  FIELD_IDS.companyName,
  FIELD_IDS.objectives,
  FIELD_IDS.fieldsOfStudy,
  FIELD_IDS.cities,
  FIELD_IDS.universities,
  FIELD_IDS.audience,
  FIELD_IDS.eventKinds,
  FIELD_IDS.budgetMin,
  FIELD_IDS.budgetMax,
  FIELD_IDS.notes,
];

export function valuesFromGoalSet(g: SponsorshipGoalSetResponse): GoalFormValues {
  return {
    name: g.name,
    companyName: g.companyName,
    objectives: [...g.objectives],
    fieldsOfStudy: [...g.audience.fieldsOfStudy],
    years: [...g.audience.years].sort((a, b) => a - b),
    cities: [...g.audience.cities],
    universities: [...g.audience.universities],
    eventKinds: [...g.eventKinds],
    budgetMin: g.budget.min === null ? "" : String(g.budget.min),
    budgetMax: g.budget.max === null ? "" : String(g.budget.max),
    visibleToClubs: g.budget.visibleToClubs,
    notes: g.notes ?? "",
  };
}

function wholeNumber(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

/** Convert form values into the POST or PUT body. Assumes the values validated. */
export function requestFromValues(v: GoalFormValues): SponsorshipGoalSetRequest {
  const notes = v.notes.trim();
  return {
    name: v.name.trim(),
    companyName: v.companyName.trim(),
    objectives: v.objectives,
    audience: {
      fieldsOfStudy: v.fieldsOfStudy,
      years: [...v.years].sort((a, b) => a - b),
      cities: v.cities,
      universities: v.universities,
    },
    eventKinds: v.eventKinds,
    budget: {
      min: wholeNumber(v.budgetMin),
      max: wholeNumber(v.budgetMax),
      visibleToClubs: v.visibleToClubs,
    },
    notes: notes ? notes : null,
  };
}

/** Build an "add items" function for a tag box with its own limits. Items are
 *  comma separated and deduplicated ignoring case. */
export function makeAdder(config: {
  min: number;
  max: number;
  maxItems: number;
  singular: string;
  plural: string;
}) {
  return function addItems(
    existing: string[],
    raw: string,
  ): { skills: string[]; error: string | null } {
    const items = [...existing];
    let error: string | null = null;
    for (const part of raw.split(",")) {
      const name = part.replace(/\s+/g, " ").trim();
      if (!name) continue;
      if (name.length < config.min || name.length > config.max) {
        error = `Each ${config.singular} needs ${config.min} to ${config.max} characters.`;
        continue;
      }
      if (items.some((f) => f.toLowerCase() === name.toLowerCase())) continue;
      if (items.length >= config.maxItems) {
        error = `You can add up to ${config.maxItems} ${config.plural}.`;
        break;
      }
      items.push(name);
    }
    return { skills: items, error };
  };
}

export const addFieldsOfStudy = makeAdder({
  min: LIMITS.fieldMin,
  max: LIMITS.fieldMax,
  maxItems: LIMITS.fieldsMax,
  singular: "field",
  plural: "fields of study",
});
export const addCities = makeAdder({
  min: LIMITS.cityMin,
  max: LIMITS.cityMax,
  maxItems: LIMITS.citiesMax,
  singular: "city",
  plural: "cities",
});
export const addUniversities = makeAdder({
  min: LIMITS.universityMin,
  max: LIMITS.universityMax,
  maxItems: LIMITS.universitiesMax,
  singular: "university",
  plural: "universities",
});

/** Fold any half typed text into the lists so a submit does not lose it. */
export function mergeDrafts(v: GoalFormValues, drafts: GoalDrafts): GoalFormValues {
  return {
    ...v,
    fieldsOfStudy: drafts.fields.trim()
      ? addFieldsOfStudy(v.fieldsOfStudy, drafts.fields).skills
      : v.fieldsOfStudy,
    cities: drafts.cities.trim() ? addCities(v.cities, drafts.cities).skills : v.cities,
    universities: drafts.universities.trim()
      ? addUniversities(v.universities, drafts.universities).skills
      : v.universities,
  };
}

/** Stable text form of the values, used to tell whether anything changed. */
export function snapshotOf(v: GoalFormValues): string {
  return JSON.stringify({
    ...v,
    name: v.name.trim(),
    companyName: v.companyName.trim(),
    years: [...v.years].sort((a, b) => a - b),
    budgetMin: v.budgetMin.trim(),
    budgetMax: v.budgetMax.trim(),
    notes: v.notes.trim(),
  });
}

export function validateGoal(v: GoalFormValues): GoalErrors {
  const errors: GoalErrors = {};

  const name = v.name.trim();
  if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
    errors[FIELD_IDS.name] = `Enter a name of ${LIMITS.nameMin} to ${LIMITS.nameMax} characters.`;
  }
  const company = v.companyName.trim();
  if (company.length < LIMITS.companyMin || company.length > LIMITS.companyMax) {
    errors[FIELD_IDS.companyName] = `Enter a company name of ${LIMITS.companyMin} to ${LIMITS.companyMax} characters.`;
  }
  if (v.objectives.length < 1) {
    errors[FIELD_IDS.objectives] = "Pick at least one objective.";
  } else if (v.objectives.length > LIMITS.objectivesMax) {
    errors[FIELD_IDS.objectives] = `Pick at most ${LIMITS.objectivesMax} objectives.`;
  }

  if (v.fieldsOfStudy.length > LIMITS.fieldsMax) {
    errors[FIELD_IDS.fieldsOfStudy] = `Add at most ${LIMITS.fieldsMax} fields of study.`;
  }
  if (v.cities.length > LIMITS.citiesMax) {
    errors[FIELD_IDS.cities] = `Add at most ${LIMITS.citiesMax} cities.`;
  }
  if (v.universities.length > LIMITS.universitiesMax) {
    errors[FIELD_IDS.universities] = `Add at most ${LIMITS.universitiesMax} universities.`;
  }
  if (
    v.fieldsOfStudy.length === 0 &&
    v.years.length === 0 &&
    v.cities.length === 0 &&
    v.universities.length === 0
  ) {
    errors[FIELD_IDS.audience] =
      "Add at least one field of study, year, city or university.";
  }

  if (v.eventKinds.length < 1) {
    errors[FIELD_IDS.eventKinds] = "Pick at least one kind of event.";
  } else if (v.eventKinds.length > LIMITS.eventKindsMax) {
    errors[FIELD_IDS.eventKinds] = `Pick at most ${LIMITS.eventKindsMax} kinds of event.`;
  }

  const bound = `Enter a whole amount from 0 to ${LIMITS.budgetMax.toLocaleString("en-US")}.`;
  let min: number | null = null;
  let max: number | null = null;
  if (v.budgetMin.trim()) {
    min = wholeNumber(v.budgetMin);
    if (min === null || min > LIMITS.budgetMax) {
      errors[FIELD_IDS.budgetMin] = bound;
      min = null;
    }
  }
  if (v.budgetMax.trim()) {
    max = wholeNumber(v.budgetMax);
    if (max === null || max > LIMITS.budgetMax) {
      errors[FIELD_IDS.budgetMax] = bound;
      max = null;
    }
  }
  if (min !== null && max !== null && min > max) {
    errors[FIELD_IDS.budgetMax] = "The maximum must be at least the minimum.";
  }

  if (v.notes.trim().length > LIMITS.notesMax) {
    errors[FIELD_IDS.notes] = `Keep the notes under ${LIMITS.notesMax} characters.`;
  }
  return errors;
}

function bdt(amount: number): string {
  return `BDT ${amount.toLocaleString("en-US")}`;
}

/**
 * Budget as plain text: "BDT 50,000 to BDT 200,000", "From BDT 50,000",
 * "Up to BDT 200,000" or "BDT 50,000" when both are equal. Null when neither
 * bound is set.
 */
export function formatBudget(
  min: number | null | undefined,
  max: number | null | undefined,
): string | null {
  const hasMin = typeof min === "number";
  const hasMax = typeof max === "number";
  if (hasMin && hasMax) {
    return min === max ? bdt(min) : `${bdt(min)} to ${bdt(max)}`;
  }
  if (hasMin) return `From ${bdt(min)}`;
  if (hasMax) return `Up to ${bdt(max)}`;
  return null;
}

/** Budget text for what a club may see, or null when it is hidden or empty. */
export function formatPublicBudget(budget: PublicBudget | null | undefined): string | null {
  if (!budget) return null;
  return formatBudget(budget.min, budget.max);
}

export function yearLabel(year: number): string {
  return `Year ${year}`;
}

export function yearsText(years: number[]): string {
  return [...years]
    .sort((a, b) => a - b)
    .map(yearLabel)
    .join(", ");
}

export type SponsorshipAction = "save" | "status" | "delete";

/** One plain sentence for a failed save, status change or delete. */
export function messageForSponsorshipError(
  error: unknown,
  action: SponsorshipAction,
): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "sponsorship_goal_not_found") {
      return "This goal set could not be found. It may have been deleted.";
    }
    if (error.errorCode === "sponsorship_goal_audience_required") {
      return "Add at least one field of study, year, city or university.";
    }
    if (error.status === 400 && error.message) return error.message;
  }
  if (action === "status") return "Could not update the goal set. Try again.";
  if (action === "delete") return "Could not delete the goal set. Try again.";
  return "Could not save the goal set. Check your connection and try again.";
}

export function nextStatus(status: GoalSetStatus): GoalSetStatus {
  return status === "Active" ? "Paused" : "Active";
}
