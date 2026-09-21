import { ApiError } from "@/lib/api/errors";
import {
  type ClubEvent,
  type ClubProfileRequest,
  type ClubProfileResponse,
  type EventFrequency,
} from "@/lib/api/clubs";

export const LIMITS = {
  nameMin: 2,
  nameMax: 150,
  taglineMax: 200,
  aboutMin: 20,
  aboutMax: 3000,
  universityMin: 2,
  universityMax: 150,
  cityMax: 100,
  foundedYearMin: 1900,
  memberCountMax: 1_000_000,
  fieldsMax: 15,
  fieldMin: 2,
  fieldMax: 60,
  eventsMax: 12,
  eventTitleMin: 3,
  eventTitleMax: 120,
  eventDescriptionMax: 1000,
  attendanceMin: 1,
  attendanceMax: 100_000,
  supportNeedsMax: 8,
} as const;

export interface EventFormValues {
  /** Stable React key. The server id once saved, a local key before that. */
  key: string;
  id?: string;
  title: string;
  description: string;
  typicalAttendance: string;
  frequency: EventFrequency;
  supportNeeds: string[];
}

export interface ClubFormValues {
  name: string;
  tagline: string;
  about: string;
  university: string;
  city: string;
  foundedYear: string;
  memberCount: string;
  fieldsOfStudy: string[];
  years: number[];
  events: EventFormValues[];
}

/** Error messages keyed by the DOM id of the field they belong to. */
export type ClubErrors = Record<string, string>;

export const EMPTY_CLUB_VALUES: ClubFormValues = {
  name: "",
  tagline: "",
  about: "",
  university: "",
  city: "",
  foundedYear: "",
  memberCount: "",
  fieldsOfStudy: [],
  years: [],
  events: [],
};

let localKeyCounter = 0;
export function newEventKey(): string {
  localKeyCounter += 1;
  return `new-${localKeyCounter}`;
}

export function emptyEvent(): EventFormValues {
  return {
    key: newEventKey(),
    title: "",
    description: "",
    typicalAttendance: "",
    frequency: "OneOff",
    supportNeeds: [],
  };
}

export const FIELD_IDS = {
  name: "club-name",
  tagline: "club-tagline",
  about: "club-about",
  university: "club-university",
  city: "club-city",
  foundedYear: "club-founded",
  memberCount: "club-members",
  fieldsOfStudy: "club-fields",
  years: "club-year-1",
} as const;

export function eventFieldId(
  key: string,
  field: "title" | "description" | "attendance",
): string {
  return `club-event-${key}-${field}`;
}

function eventFromResponse(e: ClubEvent): EventFormValues {
  return {
    key: e.id,
    id: e.id,
    title: e.title,
    description: e.description ?? "",
    typicalAttendance: String(e.typicalAttendance),
    frequency: e.frequency,
    supportNeeds: [...e.supportNeeds],
  };
}

export function valuesFromProfile(p: ClubProfileResponse): ClubFormValues {
  return {
    name: p.name,
    tagline: p.tagline ?? "",
    about: p.about,
    university: p.university,
    city: p.city ?? "",
    foundedYear: p.foundedYear === null ? "" : String(p.foundedYear),
    memberCount: String(p.memberCount),
    fieldsOfStudy: [...p.audience.fieldsOfStudy],
    years: [...p.audience.years].sort((a, b) => a - b),
    events: p.events.map(eventFromResponse),
  };
}

function wholeNumber(raw: string): number | null {
  const t = raw.trim();
  if (!/^\d+$/.test(t)) return null;
  return Number(t);
}

/** Convert form values into the PUT body. Assumes the values validated. */
export function requestFromValues(v: ClubFormValues): ClubProfileRequest {
  const tagline = v.tagline.trim();
  const city = v.city.trim();
  const founded = wholeNumber(v.foundedYear);
  return {
    name: v.name.trim(),
    tagline: tagline ? tagline : null,
    about: v.about.trim(),
    university: v.university.trim(),
    city: city ? city : null,
    foundedYear: founded,
    memberCount: wholeNumber(v.memberCount) ?? 0,
    audience: {
      fieldsOfStudy: v.fieldsOfStudy,
      years: [...v.years].sort((a, b) => a - b),
    },
    events: v.events.map((e) => {
      const description = e.description.trim();
      return {
        ...(e.id ? { id: e.id } : {}),
        title: e.title.trim(),
        description: description ? description : null,
        typicalAttendance: wholeNumber(e.typicalAttendance) ?? 0,
        frequency: e.frequency,
        supportNeeds: e.supportNeeds,
      };
    }),
  };
}

/** Stable text form of the values, used to tell whether anything changed. */
export function snapshotOf(v: ClubFormValues): string {
  return JSON.stringify({
    name: v.name.trim(),
    tagline: v.tagline.trim(),
    about: v.about.trim(),
    university: v.university.trim(),
    city: v.city.trim(),
    foundedYear: v.foundedYear.trim(),
    memberCount: v.memberCount.trim(),
    fieldsOfStudy: v.fieldsOfStudy,
    years: [...v.years].sort((a, b) => a - b),
    events: v.events.map((e) => ({
      id: e.id ?? null,
      title: e.title.trim(),
      description: e.description.trim(),
      typicalAttendance: e.typicalAttendance.trim(),
      frequency: e.frequency,
      supportNeeds: e.supportNeeds,
    })),
  });
}

/** Add one or more fields of study (comma separated), case insensitive dedupe. */
export function addFieldsOfStudy(
  existing: string[],
  raw: string,
): { skills: string[]; error: string | null } {
  const fields = [...existing];
  let error: string | null = null;
  for (const part of raw.split(",")) {
    const name = part.replace(/\s+/g, " ").trim();
    if (!name) continue;
    if (name.length < LIMITS.fieldMin || name.length > LIMITS.fieldMax) {
      error = `Each field needs ${LIMITS.fieldMin} to ${LIMITS.fieldMax} characters.`;
      continue;
    }
    if (fields.some((f) => f.toLowerCase() === name.toLowerCase())) continue;
    if (fields.length >= LIMITS.fieldsMax) {
      error = `You can add up to ${LIMITS.fieldsMax} fields of study.`;
      break;
    }
    fields.push(name);
  }
  return { skills: fields, error };
}

/** Field order on screen, used to focus the first invalid field. */
export function errorOrder(v: ClubFormValues): string[] {
  const ids: string[] = [
    FIELD_IDS.name,
    FIELD_IDS.tagline,
    FIELD_IDS.about,
    FIELD_IDS.university,
    FIELD_IDS.city,
    FIELD_IDS.foundedYear,
    FIELD_IDS.memberCount,
    FIELD_IDS.fieldsOfStudy,
  ];
  for (const e of v.events) {
    ids.push(
      eventFieldId(e.key, "title"),
      eventFieldId(e.key, "description"),
      eventFieldId(e.key, "attendance"),
    );
  }
  return ids;
}

export function validateClub(v: ClubFormValues, currentYear: number): ClubErrors {
  const errors: ClubErrors = {};

  const name = v.name.trim();
  if (name.length < LIMITS.nameMin || name.length > LIMITS.nameMax) {
    errors[FIELD_IDS.name] = `Enter a club name of ${LIMITS.nameMin} to ${LIMITS.nameMax} characters.`;
  }
  if (v.tagline.trim().length > LIMITS.taglineMax) {
    errors[FIELD_IDS.tagline] = `Keep the tagline under ${LIMITS.taglineMax} characters.`;
  }
  const about = v.about.trim();
  if (about.length < LIMITS.aboutMin || about.length > LIMITS.aboutMax) {
    errors[FIELD_IDS.about] = `Describe your club in ${LIMITS.aboutMin} to ${LIMITS.aboutMax} characters.`;
  }
  const university = v.university.trim();
  if (
    university.length < LIMITS.universityMin ||
    university.length > LIMITS.universityMax
  ) {
    errors[FIELD_IDS.university] = `Enter a university of ${LIMITS.universityMin} to ${LIMITS.universityMax} characters.`;
  }
  if (v.city.trim().length > LIMITS.cityMax) {
    errors[FIELD_IDS.city] = `Keep the city under ${LIMITS.cityMax} characters.`;
  }
  if (v.foundedYear.trim()) {
    const year = wholeNumber(v.foundedYear);
    if (year === null || year < LIMITS.foundedYearMin || year > currentYear) {
      errors[FIELD_IDS.foundedYear] = `Enter a year from ${LIMITS.foundedYearMin} to ${currentYear}.`;
    }
  }
  const members = wholeNumber(v.memberCount);
  if (members === null || members > LIMITS.memberCountMax) {
    errors[FIELD_IDS.memberCount] = `Enter the number of members, from 0 to ${LIMITS.memberCountMax.toLocaleString("en-US")}.`;
  }
  if (v.fieldsOfStudy.length > LIMITS.fieldsMax) {
    errors[FIELD_IDS.fieldsOfStudy] = `Add at most ${LIMITS.fieldsMax} fields of study.`;
  }

  for (const e of v.events) {
    const title = e.title.trim();
    if (title.length < LIMITS.eventTitleMin || title.length > LIMITS.eventTitleMax) {
      errors[eventFieldId(e.key, "title")] = `Enter a title of ${LIMITS.eventTitleMin} to ${LIMITS.eventTitleMax} characters.`;
    }
    if (e.description.trim().length > LIMITS.eventDescriptionMax) {
      errors[eventFieldId(e.key, "description")] = `Keep the description under ${LIMITS.eventDescriptionMax} characters.`;
    }
    const attendance = wholeNumber(e.typicalAttendance);
    if (
      attendance === null ||
      attendance < LIMITS.attendanceMin ||
      attendance > LIMITS.attendanceMax
    ) {
      errors[eventFieldId(e.key, "attendance")] = `Enter a number from ${LIMITS.attendanceMin} to ${LIMITS.attendanceMax.toLocaleString("en-US")}.`;
    }
  }
  return errors;
}

export interface PublishItem {
  key: string;
  label: string;
  done: boolean;
}

/** What a profile needs before it can be published, computed on the client. */
export function publishChecklist(v: ClubFormValues): PublishItem[] {
  return [
    { key: "name", label: "Club name", done: v.name.trim().length > 0 },
    { key: "about", label: "About your club", done: v.about.trim().length > 0 },
    { key: "university", label: "University", done: v.university.trim().length > 0 },
    { key: "members", label: "Member count", done: v.memberCount.trim().length > 0 },
    {
      key: "fields",
      label: "At least one field of study",
      done: v.fieldsOfStudy.length > 0,
    },
    { key: "years", label: "At least one study year", done: v.years.length > 0 },
  ];
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const second = words.length > 1 ? (words[1][0] ?? "") : "";
  return (first + second).toUpperCase() || "?";
}

export function yearsText(years: number[]): string {
  return [...years]
    .sort((a, b) => a - b)
    .map((y) => `Year ${y}`)
    .join(", ");
}

export function pluralize(count: number, one: string, many: string): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? one : many}`;
}

/** One plain sentence for a failed save, publish or unpublish. */
export function messageForClubError(
  error: unknown,
  action: "save" | "publish" | "unpublish",
): string {
  if (error instanceof ApiError && error.status === 400 && error.message) {
    return error.message;
  }
  if (action === "publish") return "Could not publish your profile. Try again.";
  if (action === "unpublish") return "Could not unpublish your profile. Try again.";
  return "Could not save your profile. Check your connection and try again.";
}

