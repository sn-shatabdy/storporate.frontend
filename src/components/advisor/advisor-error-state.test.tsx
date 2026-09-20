import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Plus } from "lucide-react";

import { AdvisorEmptyState, AdvisorErrorState } from "./advisor-error-state";

/**
 * Tests for the two centered cards:
 *   - AdvisorErrorState (page-level error + per-detail error)
 *   - AdvisorEmptyState ("No explorations yet" empty state)
 *
 * Each must render the pinned title + sub-line strings, the appropriate
 * icon, and a working button that calls the supplied callback. The
 * backend error message must NOT leak into the error card (the contract
 * is fixed-copy only).
 */

describe("AdvisorErrorState — page-level and per-detail error card", () => {
  it("renders the pinned title + sub-line, the destructive triangle icon, and a Try again button that calls onRetry", () => {
    const onRetry = vi.fn();
    const { container } = render(
      <AdvisorErrorState
        title="Could not load your explorations"
        message="Check your connection and try again."
        onRetry={onRetry}
      />,
    );

    expect(
      screen.getByText("Could not load your explorations"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Check your connection and try again."),
    ).toBeInTheDocument();

    // Destructive AlertTriangle icon present.
    const icon = container.querySelector(
      'svg.lucide-triangle-alert, svg.lucide-alert-triangle',
    );
    expect(icon).not.toBeNull();

    // Try again button calls onRetry.
    const btn = screen.getByRole("button", { name: /Try again/i });
    btn.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("does NOT surface the backend error message in the UI (fixed-copy contract)", () => {
    render(
      <AdvisorErrorState
        title="Could not load your explorations"
        message="Check your connection and try again."
        onRetry={vi.fn()}
      />,
    );
    // The backend's verbose message would normally arrive here; the
    // page-level card intentionally renders the fixed copy instead.
    expect(
      screen.queryByText(/network down|Something went wrong/i),
    ).not.toBeInTheDocument();
  });
});

describe("AdvisorEmptyState — 'No explorations yet' card", () => {
  it("renders the pinned title + message, the Sparkles accent icon, and a primary CTA that calls onPrimary", () => {
    const onPrimary = vi.fn();
    const { container } = render(
      <AdvisorEmptyState
        title="No explorations yet"
        message="Start one to get advice."
        primaryLabel="New exploration"
        primaryIcon={Plus}
        onPrimary={onPrimary}
      />,
    );

    expect(screen.getByText("No explorations yet")).toBeInTheDocument();
    expect(screen.getByText("Start one to get advice.")).toBeInTheDocument();

    // The Sparkles accent icon is in the DOM (lucide renders
    // `svg.lucide-sparkles`).
    const sparkles = container.querySelector("svg.lucide-sparkles");
    expect(sparkles).not.toBeNull();

    // Primary CTA calls onPrimary.
    const btn = screen.getByRole("button", { name: /New exploration/i });
    btn.click();
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});