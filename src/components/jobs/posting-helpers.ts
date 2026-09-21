import type {
  JobPosting,
  JobPostingRequest,
  PostingCompensation,
  PostingKind,
  WorkMode,
} from "@/lib/api/jobPostings";

export const LIMITS = {
  titleMin: 3,
  titleMax: 120,
  companyMin: 2,
  companyMax: 150,
  locationMax: 150,
  descriptionMin: 20,
  descriptionMax: 4000,
  skillsMax: 12,
  skillMin: 2,
  skillMax: 40,
  openingsMin: 1,
  openingsMax: 500,
  /** Max number of days in the future a deadline may be set. */
  deadlineMaxDays: 366,
  payMax: 10_000_000,
} as const;

/** Form-state mirror of the employer `JobPosting`. Phase 2 adds deadline,
 *  openings and compensation. */
export interface PostingFormValues {
  title: string;
  kind: PostingKind;
  companyName: string;
  location: string;
  workMode: WorkMode;
  description: string;
  requiredSkills: string[];
  /** ISO yyyy-MM-dd date string or empty string ("no deadline set"). */
  applicationDeadline: string;
  /** Whole number; default 1. */
  openings: number;
  compensation: PostingCompensation;
}

export type PostingField =
  | "title"
  | "companyName"
  | "location"
  | "description"
  | "requiredSkills"
  | "applicationDeadline"
  | "openings"
  | "compensation";

export type PostingErrors = Partial<Record<PostingField, string>>;

export const EMPTY_VALUES: PostingFormValues = {
  title: "",
  kind: "Job",
  companyName: "",
  location: "",
  workMode: "OnSite",
  description: "",
  requiredSkills: [],
  applicationDeadline: "",
  openings: 1,
  compensation: { min: null, max: null, visibleToStudents: false },
};

/** Field order on screen, used to focus the first invalid field. */
export const FIELD_ORDER: PostingField[] = [
  "title",
  "companyName",
  "applicationDeadline",
  "openings",
  "location",
  "description",
  "requiredSkills",
  "compensation",
];

export function valuesFromPosting(p: JobPosting): PostingFormValues {
  return {
    title: p.title,
    kind: p.kind,
    companyName: p.companyName,
    location: p.location ?? "",
    workMode: p.workMode,
    description: p.description,
    requiredSkills: [...p.requiredSkills],
    applicationDeadline: p.applicationDeadline ?? "",
    openings: typeof p.openings === "number" ? p.openings : 1,
    compensation: p.compensation
      ? { ...p.compensation }
      : { min: null, max: null, visibleToStudents: false },
  };
}

function nullableString(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function nullableDeadline(v: string): string | null {
  return v.trim() ? v.trim() : null;
}

function nullablePay(value: string): number | null {
  const t = value.trim().replace(/,/g, "");
  if (!t) return null;
  if (!/^\d+$/.test(t)) return Number.NaN;
  return Number(t);
}

export function requestFromValues(v: PostingFormValues): JobPostingRequest {
  const compensation: PostingCompensation = {
    min: v.compensation.min,
    max: v.compensation.max,
    visibleToStudents: v.compensation.visibleToStudents,
  };
  return {
    title: v.title.trim(),
    kind: v.kind,
    companyName: v.companyName.trim(),
    location: nullableString(v.location),
    workMode: v.workMode,
    description: v.description.trim(),
    requiredSkills: v.requiredSkills,
    applicationDeadline: nullableDeadline(v.applicationDeadline),
    openings: v.openings,
    compensation,
  };
}

/** Returns the yyyy-MM-dd string for "today" in the local time zone. */
export function todayIsoDate(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Returns ISO yyyy-MM-dd for `n` days from today. */
export function isoDateForOffset(days: number, now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return todayIsoDate(d);
}

/** Returns the number of days between two yyyy-MM-dd strings (b - a).
 *  Negative when `b` is before `a`. */
export function daysBetween(a: string, b: string): number | null {
  if (!a || !b) return null;
  const ad = new Date(`${a}T00:00:00`);
  const bd = new Date(`${b}T00:00:00`);
  if (Number.isNaN(ad.getTime()) || Number.isNaN(bd.getTime())) return null;
  return Math.round((bd.getTime() - ad.getTime()) / 86_400_000);
}

export function validatePosting(
  v: PostingFormValues,
  now: Date = new Date(),
): PostingErrors {
  const errors: PostingErrors = {};
  const title = v.title.trim();
  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) {
    errors.title = `Enter a title of ${LIMITS.titleMin} to ${LIMITS.titleMax} characters.`;
  }
  const company = v.companyName.trim();
  if (company.length < LIMITS.companyMin || company.length > LIMITS.companyMax) {
    errors.companyName = `Enter a company name of ${LIMITS.companyMin} to ${LIMITS.companyMax} characters.`;
  }
  if (v.location.trim().length > LIMITS.locationMax) {
    errors.location = `Keep the location under ${LIMITS.locationMax} characters.`;
  }
  const description = v.description.trim();
  if (
    description.length < LIMITS.descriptionMin ||
    description.length > LIMITS.descriptionMax
  ) {
    errors.description = `Describe the opening in ${LIMITS.descriptionMin} to ${LIMITS.descriptionMax} characters.`;
  }
  if (v.requiredSkills.length < 1) {
    errors.requiredSkills = "Add at least one required skill.";
  } else if (v.requiredSkills.length > LIMITS.skillsMax) {
    errors.requiredSkills = `Add at most ${LIMITS.skillsMax} skills.`;
  }

  // Deadline: optional, but if set must be today or later and within cap.
  const deadline = v.applicationDeadline.trim();
  if (deadline) {
    const diff = daysBetween(todayIsoDate(now), deadline);
    if (diff === null) {
      errors.applicationDeadline = "Enter a valid date.";
    } else if (diff < 0) {
      errors.applicationDeadline = "Pick a date today or later.";
    } else if (diff > LIMITS.deadlineMaxDays) {
      errors.applicationDeadline = `Pick a date within ${LIMITS.deadlineMaxDays} days.`;
    }
  }

  // Openings: 1..500 whole numbers.
  if (
    !Number.isInteger(v.openings) ||
    v.openings < LIMITS.openingsMin ||
    v.openings > LIMITS.openingsMax
  ) {
    errors.openings = `Openings must be a whole number from ${LIMITS.openingsMin} to ${LIMITS.openingsMax}.`;
  }

  // Compensation: optional. If any bound set, must be whole taka in range.
  const min = v.compensation.min;
  const max = v.compensation.max;
  const minSet = min !== null;
  const maxSet = max !== null;
  if (minSet && maxSet && (min as number) > (max as number)) {
    errors.compensation = "Lowest pay must not be more than highest pay.";
  } else if (minSet && (min as number) > LIMITS.payMax) {
    errors.compensation = `Each pay value must be ${LIMITS.payMax.toLocaleString(
      "en-US",
    )} or less.`;
  } else if (maxSet && (max as number) > LIMITS.payMax) {
    errors.compensation = `Each pay value must be ${LIMITS.payMax.toLocaleString(
      "en-US",
    )} or less.`;
  }
  return errors;
}

/** Parse a free-text pay value (with optional commas) to a whole number,
 *  returning null when empty and NaN for invalid text. The form mirrors
 *  this so the user can type "15,000" with the comma. */
export function parsePayInput(text: string): number | null {
  return nullablePay(text);
}

/**
 * Add one or more skills (comma separated) to an existing list. Names are
 * trimmed, whitespace collapsed, and de-duplicated ignoring case. Returns
 * the new list plus an error message when something could not be added.
 */
export function addSkills(
  existing: string[],
  raw: string,
): { skills: string[]; error: string | null } {
  const skills = [...existing];
  let error: string | null = null;
  for (const part of raw.split(",")) {
    const name = part.replace(/\s+/g, " ").trim();
    if (!name) continue;
    if (name.length < LIMITS.skillMin || name.length > LIMITS.skillMax) {
      error = `Each skill needs ${LIMITS.skillMin} to ${LIMITS.skillMax} characters.`;
      continue;
    }
    if (skills.some((s) => s.toLowerCase() === name.toLowerCase())) continue;
    if (skills.length >= LIMITS.skillsMax) {
      error = `You can add up to ${LIMITS.skillsMax} skills.`;
      break;
    }
    skills.push(name);
  }
  return { skills, error };
}
