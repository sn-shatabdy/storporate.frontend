import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { VisibilityToggleCard } from "./visibility-toggle-card";

/**
 * Tests for the master "Let employers find me" toggle card.
 *
 * Contract:
 *   - The card always renders, regardless of state.
 *   - The status line reflects the DRAFT switch state (so toggling
 *     updates the line immediately).
 *   - The master switch has the agreed accessible name.
 *   - Toggling the switch calls onCheckedChange with the next value.
 */

describe("VisibilityToggleCard", () => {
  it("renders the off-state status line when isSearchable is false", () => {
    render(
      <VisibilityToggleCard
        isSearchable={false}
        visibleItemCount={0}
        onCheckedChange={() => {}}
      />,
    );
    expect(
      screen.getByText(/Off\. Employers cannot see you or your portfolio\./),
    ).toBeInTheDocument();
  });

  it("renders the on-state status line with pluralization", () => {
    const { rerender } = render(
      <VisibilityToggleCard
        isSearchable={true}
        visibleItemCount={3}
        onCheckedChange={() => {}}
      />,
    );
    expect(
      screen.getByText(/On\. 3 portfolio items are visible in employer searches\./),
    ).toBeInTheDocument();

    rerender(
      <VisibilityToggleCard
        isSearchable={true}
        visibleItemCount={1}
        onCheckedChange={() => {}}
      />,
    );
    expect(
      screen.getByText(/On\. 1 portfolio item is visible in employer searches\./),
    ).toBeInTheDocument();

    rerender(
      <VisibilityToggleCard
        isSearchable={true}
        visibleItemCount={0}
        onCheckedChange={() => {}}
      />,
    );
    expect(
      screen.getByText(/On\. No portfolio items are ready yet\./),
    ).toBeInTheDocument();
  });

  it("renders the master switch with the accessible name 'Let employers find me'", () => {
    render(
      <VisibilityToggleCard
        isSearchable={false}
        visibleItemCount={0}
        onCheckedChange={() => {}}
      />,
    );
    const sw = screen.getByRole("switch", { name: /Let employers find me/i });
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("calls onCheckedChange with the toggled value", () => {
    const onCheckedChange = vi.fn();
    render(
      <VisibilityToggleCard
        isSearchable={false}
        visibleItemCount={0}
        onCheckedChange={onCheckedChange}
      />,
    );
    const sw = screen.getByRole("switch", { name: /Let employers find me/i });
    fireEvent.click(sw);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
