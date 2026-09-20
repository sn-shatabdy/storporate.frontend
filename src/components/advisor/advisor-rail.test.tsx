import { describe, expect, it, vi } from "vitest";
import { render, within } from "@testing-library/react";

import type { ExplorationListItem } from "@/lib/api/growth";

import { AdvisorRail } from "./advisor-rail";

/**
 * Tests for the rail's per-row status pill rendering.
 *   - A Working row renders a pill WITH an icon (the spinning Loader2).
 *   - A Failed row renders a pill WITH an icon (AlertTriangle).
 *   - An Idle row renders NO pill (the chevron-only trailing block).
 *
 * Each test asserts the pill's presence via the shared
 * `data-testid="status-pill-{variant}"` attribute the StatusPill adds.
 */

function makeItem(
  overrides: Partial<ExplorationListItem> = {},
): ExplorationListItem {
  return {
    id: "expl-x",
    title: "Test",
    status: "Idle",
    updatedAt: "2026-09-19T15:00:00Z",
    latestVersionNumber: 1,
    ...overrides,
  };
}

function getRailAside(): HTMLElement {
  const aside = document.querySelector(
    'aside[aria-label="Explorations"]',
  ) as HTMLElement | null;
  if (!aside) throw new Error("rail not in the DOM");
  return aside;
}

function findRow(title: string): HTMLButtonElement {
  const aside = getRailAside();
  const row = Array.from(aside.querySelectorAll<HTMLButtonElement>("button")).find(
    (b) => b.textContent?.includes(title),
  );
  if (!row) throw new Error(`No rail row for "${title}"`);
  return row;
}

describe("AdvisorRail — row status pills", () => {
  it("a Working row renders a working pill with an icon", () => {
    render(
      <AdvisorRail
        items={[makeItem({ id: "w", title: "Working", status: "Working" })]}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        accessToken="t"
        atLimit={false}
      />,
    );

    const row = findRow("Working");
    const pill = within(row).getByTestId("status-pill-working");
    expect(pill).toBeInTheDocument();
    // The pill carries an SVG icon.
    const icon = pill.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon!.className.baseVal).toContain("animate-spin");
  });

  it("a Failed row renders a failed pill with an icon (no spin)", () => {
    render(
      <AdvisorRail
        items={[makeItem({ id: "f", title: "Failed", status: "Failed" })]}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        accessToken="t"
        atLimit={false}
      />,
    );

    const row = findRow("Failed");
    const pill = within(row).getByTestId("status-pill-failed");
    expect(pill).toBeInTheDocument();
    const icon = pill.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon!.className.baseVal).not.toContain("animate-spin");
  });

  it("an Idle row renders NO status pill", () => {
    render(
      <AdvisorRail
        items={[makeItem({ id: "i", title: "Idle", status: "Idle" })]}
        selectedId={null}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        accessToken="t"
        atLimit={false}
      />,
    );

    const row = findRow("Idle");
    expect(within(row).queryByTestId("status-pill-working")).not.toBeInTheDocument();
    expect(within(row).queryByTestId("status-pill-failed")).not.toBeInTheDocument();
    // The row still has its chevron (the trailing chevron block is
    // present even when there's no pill).
    const chevron = row.querySelector("svg.lucide-chevron-right");
    expect(chevron).not.toBeNull();
  });
});