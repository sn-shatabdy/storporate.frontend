import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type {
  ComparisonDetail,
  ExplorationListItem,
} from "@/lib/api/growth";

import { AdvisorCompare, type CompareState } from "./advisor-compare";

/**
 * Tests for the compare view shell (AdvisorCompare).
 *
 *   - Heading "Comparison" with two title chips.
 *   - "and" connector on desktop (always rendered, `hidden lg:inline`
 *     still puts it in the DOM; the test asserts its presence in the
 *     heading row).
 *   - `result` state shows paragraphs via `whitespace-pre-line`.
 *   - `working` state shows the Working pill + a card with exactly 5
 *     animated skeleton bars.
 *   - `error` state renders the shared FailedAlert with the pinned
 *     "Try again" copy; clicking Try again calls onRetry (which the
 *     page maps to a fresh `createComparison` call).
 *   - No Sparkles icon is rendered anywhere in the compare shell.
 *   - The legacy CompareSelect component is NOT in the DOM (no checkbox
 *     list, no "Pick two" copy here).
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

function workingState(
  overrides: Partial<CompareState> = {},
): CompareState {
  return {
    status: "working",
    comparisonId: "cmp-1",
    firstId: "a",
    secondId: "b",
    ...overrides,
  } as CompareState;
}

function resultState(
  overrides: Partial<CompareState> = {},
): CompareState {
  return {
    status: "result",
    comparisonId: "cmp-1",
    firstId: "a",
    secondId: "b",
    resultText: "First paragraph.\n\nSecond paragraph.",
    ...overrides,
  } as CompareState;
}

function errorState(): CompareState {
  return {
    status: "error",
    firstId: "a",
    secondId: "b",
  };
}

describe("AdvisorCompare — heading + chips", () => {
  it("renders the 'Comparison' heading, the two title chips with the exploration titles, and the 'and' connector", () => {
    const list = [
      makeItem({ id: "a", title: "First exploration" }),
      makeItem({ id: "b", title: "Second exploration" }),
    ];
    render(
      <AdvisorCompare
        compareState={workingState()}
        list={list}
        accessToken="t"
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onCompareStateChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Comparison" }),
    ).toBeInTheDocument();

    // Both chips render with the matching exploration titles.
    const allChips = screen.getAllByTestId("status-pill-chip");
    expect(allChips).toHaveLength(2);
    expect(allChips[0]!).toHaveTextContent("First exploration");
    expect(allChips[1]!).toHaveTextContent("Second exploration");

    // The "and" connector sits in the heading row.
    expect(screen.getByText("and")).toBeInTheDocument();
  });
});

describe("AdvisorCompare — result state", () => {
  it("Completed renders each paragraph in its own <p> with whitespace-pre-line", () => {
    const list = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    render(
      <AdvisorCompare
        compareState={resultState({ resultText: "Para one.\n\nPara two.\n\nPara three." })}
        list={list}
        accessToken="t"
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onCompareStateChange={vi.fn()}
      />,
    );

    const one = screen.getByText(/Para one/);
    const two = screen.getByText(/Para two/);
    const three = screen.getByText(/Para three/);
    expect(one.className).toContain("whitespace-pre-line");
    expect(two.className).toContain("whitespace-pre-line");
    expect(three.className).toContain("whitespace-pre-line");
  });
});

describe("AdvisorCompare — working state", () => {
  it("Pending renders the Working pill + 'This takes about a minute.' copy + exactly 5 skeleton bars", () => {
    const list = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    render(
      <AdvisorCompare
        compareState={workingState()}
        list={list}
        accessToken="t"
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onCompareStateChange={vi.fn()}
      />,
    );

    // The Working pill appears.
    expect(screen.getByTestId("status-pill-working")).toBeInTheDocument();
    expect(
      screen.getByText("This takes about a minute."),
    ).toBeInTheDocument();

    // Exactly 5 animated bars (h-3 rounded-md with animate-pulse).
    const bars = document.querySelectorAll(
      "div.h-3.rounded-md.animate-pulse",
    );
    expect(bars.length).toBe(5);
  });
});

describe("AdvisorCompare — error state", () => {
  it("Failed renders the shared FailedAlert; clicking Try again calls onRetry (which the page wires to createComparison)", async () => {
    // Mock @/lib/api/growth so the ComparePoller can poll without
    // hitting the network. The poller only kicks in for `working`
    // states, so we don't actually need a mock here, but the dynamic
    // import inside the poller requires it to exist.
    vi.doMock("@/lib/api/growth", async () => {
      const actual = await vi.importActual<typeof import("@/lib/api/growth")>(
        "@/lib/api/growth",
      );
      return {
        ...actual,
        getComparison: vi.fn().mockResolvedValue({
          id: "cmp-1",
          status: "Failed",
          resultText: null,
          createdAt: "2026-09-19T15:00:00Z",
          firstExplorationId: "a",
          secondExplorationId: "b",
        } satisfies ComparisonDetail),
        createComparison: vi.fn().mockResolvedValue({
          comparisonId: "cmp-2",
        }),
      };
    });

    const onRetry = vi.fn();
    const list = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    render(
      <AdvisorCompare
        compareState={errorState()}
        list={list}
        accessToken="t"
        onCancel={vi.fn()}
        onRetry={onRetry}
        onCompareStateChange={vi.fn()}
      />,
    );

    // The shared FailedAlert card shows.
    expect(screen.getByTestId("failed-alert")).toBeInTheDocument();
    expect(
      screen.getByText("The advisor could not finish this"),
    ).toBeInTheDocument();
    // The "Try again" button is the only primary call-to-action.
    const btn = screen.getByRole("button", { name: /Try again/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});

describe("AdvisorCompare — back link", () => {
  it("the 'Back to explorations' link calls onCancel", () => {
    const onCancel = vi.fn();
    render(
      <AdvisorCompare
        compareState={workingState()}
        list={[makeItem({ id: "a" }), makeItem({ id: "b" })]}
        accessToken="t"
        onCancel={onCancel}
        onRetry={vi.fn()}
        onCompareStateChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Back to explorations/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe("AdvisorCompare — no legacy copy or icons", () => {
  it("does NOT render the legacy CompareSelect picker or any Sparkles icon", () => {
    const list = [makeItem({ id: "a" }), makeItem({ id: "b" })];
    render(
      <AdvisorCompare
        compareState={workingState()}
        list={list}
        accessToken="t"
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onCompareStateChange={vi.fn()}
      />,
    );

    // No Sparkles icon in the compare shell.
    expect(document.querySelector("svg.lucide-sparkles")).not.toBeInTheDocument();
    // No checkboxes (the legacy CompareSelect had per-row checkboxes).
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    // No "Pick two explorations." copy (that copy lives in the rail,
    // not the compare shell).
    expect(
      screen.queryByText(/Pick two explorations/i),
    ).not.toBeInTheDocument();
  });
});
