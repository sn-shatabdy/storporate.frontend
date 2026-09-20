// Pin a known timezone for the whole file so the local-time assertions
// are reproducible regardless of the host CI's default zone. The
// formatter must read in the VIEWER's local timezone (so a Dhaka
// student sees their own clock); this file pins Asia/Dhaka at the top
// so the "Dhaka student sees 21:33" assertion exercises the formatter
// end-to-end. The file still passes under `TZ=UTC` because Node honors
// the assignment below and the formatter reads in the pinned zone.
process.env.TZ = "Asia/Dhaka";

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
  // The formatter must read in the VIEWER's local timezone — the wire
  // timestamp is UTC, but a student in Dhaka (UTC+6) should see their
  // local clock, not 6 hours earlier. These tests build the input from
  // local parts so they pass on ANY host timezone.

  it("renders a local 09:14 timestamp as '20 Sep, 09:14'", () => {
    // `new Date(2026, 8, 20, 9, 14)` is 20 Sep 2026 09:14 LOCAL.
    const iso = new Date(2026, 8, 20, 9, 14).toISOString();
    expect(formatSummaryTime(iso, NOW)).toBe("20 Sep, 09:14");
  });

  it("renders a local 21:33 timestamp as '20 Sep, 21:33'", () => {
    // The Dhaka live-evidence case: a summary written at 21:33 local
    // must show "21:33", not whatever the UTC reading happens to be.
    const iso = new Date(2026, 8, 20, 21, 33).toISOString();
    expect(formatSummaryTime(iso, NOW)).toBe("20 Sep, 21:33");
  });

  it("renders midnight as '00:00' (en-GB 24-hour, not '24:00')", () => {
    const iso = new Date(2026, 8, 20, 0, 0).toISOString();
    expect(formatSummaryTime(iso, NOW)).toBe("20 Sep, 00:00");
  });

  it("includes the year when the date is in a different calendar year", () => {
    const iso = new Date(2025, 8, 20, 9, 14).toISOString();
    expect(formatSummaryTime(iso, NOW)).toBe("20 Sep 2025, 09:14");
  });

  it("renders the time in the viewer's local timezone (Asia/Dhaka case)", () => {
    // The wire ISO 2026-09-20T15:33:00Z is 21:33 in Asia/Dhaka
    // (UTC+6) — a Dhaka student must see "21:33". This test fails on
    // the old UTC-pinned formatter (it would print "15:33").
    expect(formatSummaryTime("2026-09-20T15:33:00Z", NOW)).toBe(
      "20 Sep, 21:33",
    );
  });

  it("falls back to the raw ISO when the input is unparseable", () => {
    expect(formatSummaryTime("nope", NOW)).toBe("nope");
  });
});
