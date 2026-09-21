import { describe, expect, it } from "vitest";

import {
  composeDetailLine,
  counterLine,
  formatFileSize,
  MAX_QUERY_CHARS,
  messageForQueryValidation,
  messageForTalentSearchError,
  MIN_QUERY_CHARS,
  resultsCountLine,
  srResultsAnnouncement,
  typeLabelFor,
  validateQuery,
} from "./helpers";

/**
 * Unit tests for the pure helpers in `./helpers.ts`. Pins every helper
 * that has logic. The string-content assertions use exact-match (not
 * `toContain`) for the user-facing copy so an accidental future tweak
 * — adding a word, a punctuation mark, or a banned term — fails the
 * suite immediately.
 */

describe("initialsFor (re-exported from discovery helpers)", () => {
  it("matches the discovery-page algorithm exactly", async () => {
    const { initialsFor } = await import("./helpers");
    expect(initialsFor("Nadia Rahman")).toBe("NR");
    expect(initialsFor("Nadia")).toBe("N");
    expect(initialsFor("   ")).toBe("?");
  });
});

describe("composeDetailLine", () => {
  it("includes only the parts whose value is present (non-null and non-empty)", () => {
    const line = composeDetailLine({
      university: "BUET",
      fieldOfStudy: "CSE",
      studyYear: 3,
    });
    expect(line.parts).toEqual(["BUET", "CSE", "Year 3"]);
    expect(line.hasAnyShownPart).toBe(true);
  });

  it("hides parts when the value is null", () => {
    const line = composeDetailLine({
      university: null,
      fieldOfStudy: "CSE",
      studyYear: null,
    });
    expect(line.parts).toEqual(["CSE"]);
    expect(line.hasAnyShownPart).toBe(true);
  });

  it("hides parts when the value is empty string", () => {
    const line = composeDetailLine({
      university: "",
      fieldOfStudy: "CSE",
      studyYear: 4,
    });
    expect(line.parts).toEqual(["CSE", "Year 4"]);
  });

  it("hides parts whose value is whitespace-only", () => {
    const line = composeDetailLine({
      university: "  ",
      fieldOfStudy: "CSE",
      studyYear: 2,
    });
    expect(line.parts).toEqual(["CSE", "Year 2"]);
  });

  it("reports hasAnyShownPart=false when every part is hidden (null / empty)", () => {
    const line = composeDetailLine({
      university: null,
      fieldOfStudy: null,
      studyYear: null,
    });
    expect(line.parts).toEqual([]);
    expect(line.hasAnyShownPart).toBe(false);
  });

  it("puts university first, field of study second, Year N third", () => {
    const line = composeDetailLine({
      university: "BUET",
      fieldOfStudy: "Computer Science",
      studyYear: 1,
    });
    expect(line.parts).toEqual(["BUET", "Computer Science", "Year 1"]);
  });
});

describe("validateQuery", () => {
  it("returns 'empty' when the input is empty", () => {
    expect(validateQuery("")).toEqual({ kind: "empty" });
    expect(validateQuery("   ")).toEqual({ kind: "empty" });
  });

  it("returns 'too_short' for trimmed lengths under the minimum", () => {
    expect(validateQuery("abc")).toEqual({ kind: "too_short", trimmedLength: 3 });
    // Surrounding whitespace must not count toward the length.
    expect(validateQuery("  abcdefghi  ")).toEqual({
      kind: "too_short",
      trimmedLength: 9,
    });
  });

  it("returns 'valid' for trimmed lengths at or above the minimum", () => {
    expect(validateQuery("a".repeat(MIN_QUERY_CHARS))).toEqual({
      kind: "valid",
      trimmedLength: MIN_QUERY_CHARS,
    });
  });

  it("returns 'valid' for trimmed lengths at or below the maximum", () => {
    expect(validateQuery("a".repeat(MAX_QUERY_CHARS))).toEqual({
      kind: "valid",
      trimmedLength: MAX_QUERY_CHARS,
    });
  });

  it("returns 'too_long' for trimmed lengths above the maximum", () => {
    expect(validateQuery("a".repeat(MAX_QUERY_CHARS + 1))).toEqual({
      kind: "too_long",
      trimmedLength: MAX_QUERY_CHARS + 1,
    });
  });

  it("uses trimmed length in the result, not raw", () => {
    // 10 inner chars plus 8 wrapping whitespace = 18 raw, 10 trimmed.
    expect(validateQuery("    abcdefghij    ")).toEqual({
      kind: "valid",
      trimmedLength: 10,
    });
  });
});

describe("messageForQueryValidation", () => {
  it("returns the agreed copy for too_short", () => {
    expect(messageForQueryValidation({ kind: "too_short", trimmedLength: 5 })).toBe(
      "Write at least 10 characters.",
    );
  });

  it("returns the agreed copy for too_long", () => {
    expect(messageForQueryValidation({ kind: "too_long", trimmedLength: 1001 })).toBe(
      "Use 1000 characters or fewer.",
    );
  });

  it("returns null for empty and valid (no message under the box)", () => {
    expect(messageForQueryValidation({ kind: "empty" })).toBeNull();
    expect(messageForQueryValidation({ kind: "valid", trimmedLength: 12 })).toBeNull();
  });
});

describe("counterLine", () => {
  it("shows the idle copy when the input is empty / whitespace-only", () => {
    expect(counterLine("")).toBe(
      "0 of 1000 characters. A search can take up to a minute.",
    );
    expect(counterLine("   ")).toBe(
      "0 of 1000 characters. A search can take up to a minute.",
    );
  });

  it("uses the raw (untrimmed) length in the typed state", () => {
    // 12 raw + 4 leading spaces = 16 raw, 12 trimmed → still 16 raw.
    expect(counterLine("    hello there!")).toBe("16 of 1000 characters.");
  });
});

describe("resultsCountLine — pluralization", () => {
  it("uses '1 student' for a single result", () => {
    expect(resultsCountLine(1)).toBe("1 student, best match first");
  });

  it("uses 'N students' for any other count", () => {
    expect(resultsCountLine(0)).toBe("0 students, best match first");
    expect(resultsCountLine(2)).toBe("2 students, best match first");
    expect(resultsCountLine(10)).toBe("10 students, best match first");
  });
});

describe("srResultsAnnouncement", () => {
  it("uses 'No matching students.' for an empty list", () => {
    expect(srResultsAnnouncement(0)).toBe("No matching students.");
  });

  it("uses '1 student found.' for a single result", () => {
    expect(srResultsAnnouncement(1)).toBe("1 student found.");
  });

  it("uses 'N students found.' for N >= 2", () => {
    expect(srResultsAnnouncement(2)).toBe("2 students found.");
    expect(srResultsAnnouncement(10)).toBe("10 students found.");
  });
});

describe("messageForTalentSearchError", () => {
  it("maps known query-validation codes to the inline message", () => {
    expect(messageForTalentSearchError("talent_search_query_required")).toBe(
      "Write at least 10 characters.",
    );
    expect(messageForTalentSearchError("talent_search_query_too_short")).toBe(
      "Write at least 10 characters.",
    );
    expect(messageForTalentSearchError("talent_search_query_too_long")).toBe(
      "Use 1000 characters or fewer.",
    );
  });

  it("maps talent_search_busy to the busy notice", () => {
    expect(messageForTalentSearchError("talent_search_busy")).toBe(
      "A search is already running. Wait for it to finish.",
    );
  });

  it("returns null for unknown / non-validation codes so the page falls back to the failed alert", () => {
    expect(messageForTalentSearchError("permission_denied")).toBeNull();
    expect(messageForTalentSearchError("llm_provider_error")).toBeNull();
    expect(messageForTalentSearchError("nope")).toBeNull();
  });
});

describe("typeLabelFor — short MIME labels", () => {
  it("returns 'PDF' for application/pdf", () => {
    expect(typeLabelFor("application/pdf")).toBe("PDF");
  });

  it("returns 'Image' for every supported image MIME", () => {
    expect(typeLabelFor("image/png")).toBe("Image");
    expect(typeLabelFor("image/jpeg")).toBe("Image");
    expect(typeLabelFor("image/gif")).toBe("Image");
    expect(typeLabelFor("image/webp")).toBe("Image");
  });

  it("returns 'Video' for mp4/webm", () => {
    expect(typeLabelFor("video/mp4")).toBe("Video");
    expect(typeLabelFor("video/webm")).toBe("Video");
  });

  it("returns 'Word', 'PowerPoint', 'Excel' for the office OOXML types", () => {
    expect(typeLabelFor("application/msword")).toBe("Word");
    expect(
      typeLabelFor(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe("Word");
    expect(typeLabelFor("application/vnd.ms-powerpoint")).toBe("PowerPoint");
    expect(
      typeLabelFor(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ),
    ).toBe("PowerPoint");
    expect(typeLabelFor("application/vnd.ms-excel")).toBe("Excel");
    expect(
      typeLabelFor(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe("Excel");
  });

  it("returns 'Text', 'CSV', 'ZIP' for the plain-text / archive types", () => {
    expect(typeLabelFor("text/plain")).toBe("Text");
    expect(typeLabelFor("text/csv")).toBe("CSV");
    expect(typeLabelFor("application/zip")).toBe("ZIP");
    expect(typeLabelFor("application/x-zip-compressed")).toBe("ZIP");
  });

  it("falls back to 'File' for unknown / null content types", () => {
    expect(typeLabelFor("application/octet-stream")).toBe("File");
    expect(typeLabelFor("")).toBe("File");
    expect(typeLabelFor(null)).toBe("File");
  });
});

describe("formatFileSize — 1024-unit buckets", () => {
  it("uses bare bytes below 1 KB", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(12)).toBe("12 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats KB with one decimal between 1 KB and 1 MB", () => {
    // 340 * 1024 = 348160 → "340.0 KB"
    expect(formatFileSize(348160)).toBe("340.0 KB");
    // 999 KB — the boundary below 1 MB → "999.0 KB"
    expect(formatFileSize(999 * 1024)).toBe("999.0 KB");
  });

  it("formats MB with one decimal between 1 MB and 1 GB", () => {
    // 2.4 * 1024 * 1024 bytes = 2.4 MB exact
    const twoPointFourMB = Math.round(2.4 * 1024 * 1024);
    expect(formatFileSize(twoPointFourMB)).toBe("2.4 MB");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
  });

  it("returns null when the size is null / negative / NaN", () => {
    expect(formatFileSize(null)).toBeNull();
    expect(formatFileSize(-1)).toBeNull();
    expect(formatFileSize(Number.NaN)).toBeNull();
  });
});
