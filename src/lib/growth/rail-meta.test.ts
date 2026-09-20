import { describe, expect, it } from "vitest";

import { railMeta } from "./rail-meta";
import type { ExplorationListItem } from "@/lib/api/growth";

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
  it("returns 'Preparing' for a Working exploration with no summary yet", () => {
    expect(
      railMeta(item({ status: "Working", latestVersionNumber: null }), NOW),
    ).toBe("Preparing");
  });

  it("returns 'Waiting for your answers' for a Working exploration with a summary", () => {
    expect(
      railMeta(item({ status: "Working", latestVersionNumber: 2 }), NOW),
    ).toBe("Waiting for your answers");
  });

  it("returns 'Failed' for a Failed exploration", () => {
    expect(
      railMeta(item({ status: "Failed" }), NOW),
    ).toBe("Failed");
  });

  it("returns 'Updated {relative}' for an Idle exploration", () => {
    expect(railMeta(item({ status: "Idle" }), NOW)).toBe("Updated 1 h ago");
  });
});
