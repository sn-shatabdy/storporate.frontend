import type {
  JobPosting,
  JobPostingRequest,
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
} as const;

export interface PostingFormValues {
  title: string;
  kind: PostingKind;
  companyName: string;
  location: string;
  workMode: WorkMode;
  description: string;
  requiredSkills: string[];
}

export type PostingField =
  | "title"
  | "companyName"
  | "location"
  | "description"
  | "requiredSkills";

export type PostingErrors = Partial<Record<PostingField, string>>;

export const EMPTY_VALUES: PostingFormValues = {
  title: "",
  kind: "Job",
  companyName: "",
  location: "",
  workMode: "OnSite",
  description: "",
  requiredSkills: [],
};

/** Field order on screen, used to focus the first invalid field. */
export const FIELD_ORDER: PostingField[] = [
  "title",
  "companyName",
  "location",
  "description",
  "requiredSkills",
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
  };
}

export function requestFromValues(v: PostingFormValues): JobPostingRequest {
  const location = v.location.trim();
  return {
    title: v.title.trim(),
    kind: v.kind,
    companyName: v.companyName.trim(),
    location: location ? location : null,
    workMode: v.workMode,
    description: v.description.trim(),
    requiredSkills: v.requiredSkills,
  };
}

export function validatePosting(v: PostingFormValues): PostingErrors {
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
  return errors;
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
