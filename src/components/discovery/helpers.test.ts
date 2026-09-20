import { describe, expect, it } from "vitest";

import type { SearchableProfile } from "@/lib/api/discovery";

import {
  draftFromProfile,
  errorCodeToField,
  initialsFor,
  isDraftDirty,
  masterStatusLine,
  messageForFieldError,
  messageForStudyYearRangeError,
  offStateFooterLine,
  previewItemsLine,
  previewLineFor,
  requestFromDraft,
  validateDraft,
  type ProfileDraft,
} from "./helpers";

/**
 * Unit tests for the pure helpers in `./helpers.ts`. Covers every helper
 * that has logic, plus the pluralization rules the design spec calls out
 * (0 / 1 / N) so a future tweak fails the suite immediately.
 */

const SAVED: SearchableProfile = {
  isSearchable: false,
  displayName: "",
  headline: null,
  university: null,
  fieldOfStudy: null,
  studyYear: null,
  showHeadline: true,
  showUniversity: true,
  showFieldOfStudy: true,
  showStudyYear: true,
  optedInAt: null,
  updatedAt: "2026-09-21T00:00:00Z",
  visibleItemCount: 0,
};

const baseDraft: ProfileDraft = {
  isSearchable: false,
  displayName: "",
  headline: "",
  university: "",
  fieldOfStudy: "",
  studyYear: null,
  showHeadline: true,
  showUniversity: true,
  showFieldOfStudy: true,
  showStudyYear: true,
};

describe("initialsFor", () => {
  it("returns the first letters of up to two words in uppercase", () => {
    expect(initialsFor("Nadia Rahman")).toBe("NR");
    expect(initialsFor("nadia rahman")).toBe("NR");
    expect(initialsFor("Nadia")).toBe("N");
    expect(initialsFor("  Nadia  Rahman  ")).toBe("NR");
  });

  it("returns ? for an empty or whitespace-only name", () => {
    expect(initialsFor("")).toBe("?");
    expect(initialsFor("   ")).toBe("?");
  });
});

describe("previewLineFor", () => {
  it("includes only the parts whose show switch is on and whose value is non-empty", () => {
    const line = previewLineFor({
      university: "BUET",
      fieldOfStudy: "CSE",
      studyYear: 3,
      showUniversity: true,
      showFieldOfStudy: false,
      showStudyYear: true,
    });
    expect(line.parts).toEqual(["BUET", "Year 3"]);
    expect(line.hasAnyShownPart).toBe(true);
  });

  it("hides parts when the value is empty (even when the switch is on)", () => {
    const line = previewLineFor({
      university: "",
      fieldOfStudy: "CSE",
      studyYear: null,
      showUniversity: true,
      showFieldOfStudy: true,
      showStudyYear: true,
    });
    expect(line.parts).toEqual(["CSE"]);
  });

  it("reports hasAnyShownPart=false when every part is hidden", () => {
    const line = previewLineFor({
      university: "BUET",
      fieldOfStudy: "CSE",
      studyYear: 3,
      showUniversity: false,
      showFieldOfStudy: false,
      showStudyYear: false,
    });
    expect(line.parts).toEqual([]);
    expect(line.hasAnyShownPart).toBe(false);
  });
});

describe("requestFromDraft", () => {
  it("sends empty strings for cleared optional text fields", () => {
    const body = requestFromDraft({
      ...baseDraft,
      isSearchable: true,
      displayName: "Nadia Rahman",
      university: "BUET",
      fieldOfStudy: "",
    });
    expect(body).toMatchObject({
      isSearchable: true,
      displayName: "Nadia Rahman",
      university: "BUET",
      fieldOfStudy: "",
      headline: "",
    });
  });

  it("omits studyYear entirely when null (no clear verb)", () => {
    const body = requestFromDraft({ ...baseDraft, studyYear: null });
    expect("studyYear" in body).toBe(false);
  });

  it("includes studyYear when a year is chosen", () => {
    const body = requestFromDraft({ ...baseDraft, studyYear: 3 });
    expect(body.studyYear).toBe(3);
  });

  it("trims the displayName before sending", () => {
    const body = requestFromDraft({
      ...baseDraft,
      isSearchable: true,
      displayName: "  Nadia Rahman  ",
    });
    expect(body.displayName).toBe("Nadia Rahman");
  });
});

describe("draftFromProfile", () => {
  it("maps wire nulls to empty strings on text fields and preserves studyYear", () => {
    const draft = draftFromProfile(SAVED);
    expect(draft).toEqual(baseDraft);
  });

  it("preserves actual values", () => {
    const draft = draftFromProfile({
      ...SAVED,
      displayName: "Nadia",
      headline: "Hello",
      university: "BUET",
      fieldOfStudy: "CSE",
      studyYear: 3,
    });
    expect(draft.displayName).toBe("Nadia");
    expect(draft.headline).toBe("Hello");
    expect(draft.university).toBe("BUET");
    expect(draft.fieldOfStudy).toBe("CSE");
    expect(draft.studyYear).toBe(3);
  });
});

describe("isDraftDirty", () => {
  it("returns false for a draft that matches the saved profile", () => {
    expect(isDraftDirty(baseDraft, SAVED)).toBe(false);
  });

  it("returns true when the master switch is flipped", () => {
    expect(isDraftDirty({ ...baseDraft, isSearchable: true }, SAVED)).toBe(true);
  });

  it("returns true when a show switch is flipped", () => {
    expect(isDraftDirty({ ...baseDraft, showUniversity: false }, SAVED)).toBe(true);
  });

  it("returns true when the trimmed displayName diverges", () => {
    expect(
      isDraftDirty({ ...baseDraft, displayName: "Nadia" }, SAVED),
    ).toBe(true);
  });

  it("returns true when the saved displayName differs only by surrounding whitespace", () => {
    const saved = { ...SAVED, displayName: "Nadia" };
    expect(isDraftDirty({ ...baseDraft, displayName: "Nadia" }, saved)).toBe(false);
    expect(isDraftDirty({ ...baseDraft, displayName: "  Nadia  " }, saved)).toBe(false);
  });

  it("returns true when studyYear changes", () => {
    expect(isDraftDirty({ ...baseDraft, studyYear: 3 }, SAVED)).toBe(true);
  });
});

describe("validateDraft", () => {
  it("does not require a display name when the master switch is off", () => {
    const errors = validateDraft(
      { ...baseDraft, isSearchable: false },
      { requireDisplayName: false },
    );
    expect(errors).toEqual({});
  });

  it("flags an empty display name when the master switch is on", () => {
    const errors = validateDraft(
      { ...baseDraft, isSearchable: true },
      { requireDisplayName: true },
    );
    expect(errors.displayName).toBe("display_name_required");
  });

  it("flags a too-long display name", () => {
    const errors = validateDraft(
      { ...baseDraft, isSearchable: true, displayName: "x".repeat(81) },
      { requireDisplayName: true },
    );
    expect(errors.displayName).toBe("display_name_too_long");
  });

  it("flags over-length optional fields", () => {
    const long = "x".repeat(121);
    const errors = validateDraft(
      {
        ...baseDraft,
        isSearchable: true,
        displayName: "Nadia",
        headline: long,
        university: long,
        fieldOfStudy: long,
      },
      { requireDisplayName: true },
    );
    expect(errors.headline).toBe("headline_too_long");
    expect(errors.university).toBe("university_too_long");
    expect(errors.fieldOfStudy).toBe("field_of_study_too_long");
  });
});

describe("errorCodeToField", () => {
  it("maps known field-level codes", () => {
    expect(errorCodeToField("display_name_required")).toEqual({
      field: "displayName",
      code: "display_name_required",
    });
    expect(errorCodeToField("display_name_too_long")).toEqual({
      field: "displayName",
      code: "display_name_too_long",
    });
    expect(errorCodeToField("headline_too_long")).toEqual({
      field: "headline",
      code: "headline_too_long",
    });
    expect(errorCodeToField("university_too_long")).toEqual({
      field: "university",
      code: "university_too_long",
    });
    expect(errorCodeToField("field_of_study_too_long")).toEqual({
      field: "fieldOfStudy",
      code: "field_of_study_too_long",
    });
  });

  it("returns null for study_year_out_of_range (no draft field)", () => {
    expect(errorCodeToField("study_year_out_of_range")).toBeNull();
  });

  it("returns null for unknown codes so the caller falls back to the form-level alert", () => {
    expect(errorCodeToField("permission_denied")).toBeNull();
    expect(errorCodeToField("nope")).toBeNull();
  });
});

describe("messageForFieldError", () => {
  it("returns the pinned message for every field error", () => {
    expect(messageForFieldError("display_name_required")).toBe("Enter a display name.");
    expect(messageForFieldError("display_name_too_long")).toBe("Use 80 characters or fewer.");
    expect(messageForFieldError("headline_too_long")).toBe("Use 120 characters or fewer.");
    expect(messageForFieldError("university_too_long")).toBe("Use 120 characters or fewer.");
    expect(messageForFieldError("field_of_study_too_long")).toBe("Use 120 characters or fewer.");
  });
});

describe("messageForStudyYearRangeError", () => {
  it("returns the pinned message", () => {
    expect(messageForStudyYearRangeError()).toBe("Choose a year from 1 to 8.");
  });
});

describe("masterStatusLine — pluralization (0 / 1 / N)", () => {
  it("off state is the off message regardless of visibleItemCount", () => {
    expect(masterStatusLine(false, 0)).toContain("Off.");
    expect(masterStatusLine(false, 1)).toContain("Off.");
    expect(masterStatusLine(false, 3)).toContain("Off.");
  });

  it("on state with 0 items mentions no items", () => {
    expect(masterStatusLine(true, 0)).toContain("No portfolio items are ready yet.");
  });

  it("on state with 1 item uses the singular form", () => {
    expect(masterStatusLine(true, 1)).toContain("1 portfolio item is visible");
  });

  it("on state with N items uses the plural form", () => {
    expect(masterStatusLine(true, 3)).toContain("3 portfolio items are visible");
  });
});

describe("offStateFooterLine — pluralization", () => {
  it("0 uses 'No portfolio items'", () => {
    expect(offStateFooterLine(0)).toContain("No portfolio items are ready yet");
  });
  it("1 uses '1 portfolio item is ready'", () => {
    expect(offStateFooterLine(1)).toContain("1 portfolio item is ready");
  });
  it("N uses the plural", () => {
    expect(offStateFooterLine(3)).toContain("3 portfolio items are ready");
  });
});

describe("previewItemsLine — pluralization", () => {
  it("0 mentions an analyzed item", () => {
    expect(previewItemsLine(0)).toContain("once you have an analyzed item");
  });
  it("1 uses '1 portfolio item'", () => {
    expect(previewItemsLine(1)).toContain("1 portfolio item");
  });
  it("N uses the plural", () => {
    expect(previewItemsLine(3)).toContain("3 portfolio items");
  });
});
