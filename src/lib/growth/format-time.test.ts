import { describe, expect, it } from "vitest";

import {
  formatStarted,
  formatSummaryTime,
  formatUpdated,
} from "./format-time";

/** A frozen "now" the tests pin all relative-time assertions against, so
 * the suite is deterministic regardless of wall-clock drift between runs. */
const NOW = new Date("2026-09-19T12:00:00Z");

describe("formatUpdated", () => {
  it("returns 'just now' for differences under one minute", () => {
    expect(formatUpdated("2026-09-19T11:59:30Z", NOW)).toBe("just now");
    expect(formatUpdated("2026-09-19T12:00:00Z", NOW)).toBe("just now");
  });

  it("returns '1 min ago' (singular) at exactly one minute", () => {
    expect(formatUpdated("2026-09-19T11:59:00Z", NOW)).toBe("1 min ago");
  });

  it("returns plural '{n} min ago' for two to fifty-nine minutes", () => {
    expect(formatUpdated("2026-09-19T11:58:00Z", NOW)).toBe("2 min ago");
    expect(formatUpdated("2026-09-19T11:01:00Z", NOW)).toBe("59 min ago");
  });

  it("returns '1 h ago' (singular) at exactly one hour", () => {
    expect(formatUpdated("2026-09-19T11:00:00Z", NOW)).toBe("1 h ago");
  });

  it("returns plural '{n} h ago' for two to twenty-three hours", () => {
    expect(formatUpdated("2026-09-19T10:00:00Z", NOW)).toBe("2 h ago");
    expect(formatUpdated("2026-09-18T13:00:00Z", NOW)).toBe("23 h ago");
  });

  it("returns '1 day ago' (singular) at exactly one day", () => {
    expect(formatUpdated("2026-09-18T12:00:00Z", NOW)).toBe("1 day ago");
  });

  it("returns plural '{n} days ago' for two to six days", () => {
    expect(formatUpdated("2026-09-17T12:00:00Z", NOW)).toBe("2 days ago");
    expect(formatUpdated("2026-09-13T12:00:00Z", NOW)).toBe("6 days ago");
  });

  it("returns the short date '12 Sep' for dates seven days or older in the same year", () => {
    expect(formatUpdated("2026-09-12T12:00:00Z", NOW)).toBe("12 Sep");
    expect(formatUpdated("2026-08-19T12:00:00Z", NOW)).toBe("19 Aug");
  });

  it("includes the year when the date is in a different calendar year", () => {
    // Same month+day, previous year → "12 Sep 2025"
    const sameMdayEarlierYear = new Date("2025-09-12T00:00:00Z");
    expect(formatUpdated(sameMdayEarlierYear.toISOString(), NOW)).toBe(
      "12 Sep 2025",
    );
  });

  it("returns '' for an unparseable string", () => {
    expect(formatUpdated("not-a-date", NOW)).toBe("");
  });
});

describe("formatStarted", () => {
  it("prefixes the short date with 'Started '", () => {
    expect(formatStarted("2026-09-12T00:00:00Z", NOW)).toBe("Started 12 Sep");
  });

  it("includes the year when the date is in a different year", () => {
    expect(formatStarted("2025-09-12T00:00:00Z", NOW)).toBe(
      "Started 12 Sep 2025",
    );
  });

  it("falls back to 'Started {raw}' when the ISO can't be parsed", () => {
    expect(formatStarted("garbage", NOW)).toBe("Started garbage");
  });
});

describe("formatSummaryTime", () => {
  it("formats the date as en-GB day + short month with the 24-hour time", () => {
    // The approved design canvas pins "20 Sep, 09:14"; we exercise the
    // exact same wire input. Locale and timezone are pinned by the
    // `toLocaleTimeString("en-GB", ...)` call so the assertion holds
    // regardless of the host's default locale.
    expect(formatSummaryTime("2026-09-20T09:14:00Z", NOW)).toBe("20 Sep, 09:14");
  });

  it("renders the time as HH:mm even when minutes or hours are zero", () => {
    expect(formatSummaryTime("2026-09-20T00:00:00Z", NOW)).toBe("20 Sep, 00:00");
    expect(formatSummaryTime("2026-09-20T09:05:00Z", NOW)).toBe("20 Sep, 09:05");
  });

  it("includes the year when the date is in a different calendar year", () => {
    expect(formatSummaryTime("2025-09-20T09:14:00Z", NOW)).toBe("20 Sep 2025, 09:14");
  });

  it("renders the time in UTC regardless of the host timezone", () => {
    // The wire ISO is UTC; the formatter pins `timeZone: "UTC"` so a CI
    // host in any zone produces the same canonical string.
    expect(formatSummaryTime("2026-09-20T23:59:00Z", NOW)).toBe("20 Sep, 23:59");
  });

  it("falls back to the raw ISO when the input is unparseable", () => {
    expect(formatSummaryTime("nope", NOW)).toBe("nope");
  });
});
