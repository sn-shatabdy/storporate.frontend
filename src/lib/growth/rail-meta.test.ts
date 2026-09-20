import { describe, expect, it } from "vitest";

import { railMeta } from "./rail-meta";
import type { ExplorationListItem } from "@/lib/api/growth";

/** Frozen "now" the suite pins every relative-time assertion against,
 * so the test host's wall clock can't drift the assertions. */
const NOW = new Date("2026-09-19T16:00:00Z");

function item(overrides: Partial<ExplorationListItem> = {}): ExplorationListItem {
  return {
    id: "expl-1",
    title: "Whatever",
    status: "Idle",
    updatedAt: "2026-09-19T15:00:00Z",
    latestVersionNumber: 1,
    ...overrides,
  };
}

describe("railMeta", () => {
  it("returns 'Failed' for a Failed exploration regardless of summary state", () => {
    expect(railMeta(item({ status: "Failed" }), NOW)).toBe("Failed");
    expect(
      railMeta(item({ status: "Failed", latestVersionNumber: null }), NOW),
    ).toBe("Failed");
  });

  it("returns 'Preparing' for a Working exploration with no summary", () => {
    // latestVersionNumber = null  → "Preparing"
    expect(
      railMeta(item({ status: "Working", latestVersionNumber: null }), NOW),
    ).toBe("Preparing");
  });

  it("returns 'Preparing' for a Working exploration when latestVersionNumber is undefined (older fixtures)", () => {
    // The wire shape can come back with the field omitted entirely
    // (older fixtures / different backends); the loose `==` null check
    // collapses both `null` and `undefined` into "no summary".
    expect(
      railMeta(
        item({ status: "Working", latestVersionNumber: undefined }),
        NOW,
      ),
    ).toBe("Preparing");
  });

  it("returns 'Working' for a Working exploration with a summary version", () => {
    expect(
      railMeta(item({ status: "Working", latestVersionNumber: 2 }), NOW),
    ).toBe("Working");
  });

  it("returns 'Waiting for your answers' for an Idle exploration with no summary", () => {
    expect(
      railMeta(item({ status: "Idle", latestVersionNumber: null }), NOW),
    ).toBe("Waiting for your answers");
  });

  it("returns 'Waiting for your answers' for an Idle exploration when latestVersionNumber is undefined", () => {
    expect(
      railMeta(
        item({ status: "Idle", latestVersionNumber: undefined }),
        NOW,
      ),
    ).toBe("Waiting for your answers");
  });

  it("returns 'Updated {relative}' for an Idle exploration with a summary version", () => {
    expect(railMeta(item({ status: "Idle" }), NOW)).toBe("Updated 1 h ago");
  });
});
