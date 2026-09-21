import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SharedInfoCard } from "./shared-info-card";

/**
 * Tests for the off-state info card. Confirms the two columns and the
 * pluralized footer line render with the correct copy.
 */

describe("SharedInfoCard", () => {
  it("renders the 'Shared when on' and 'Never shared' columns", () => {
    render(<SharedInfoCard visibleItemCount={0} />);
    expect(screen.getByText("Shared when on")).toBeInTheDocument();
    expect(screen.getByText("Never shared")).toBeInTheDocument();
    expect(screen.getByText("Your display name")).toBeInTheDocument();
    expect(screen.getByText("Your email address")).toBeInTheDocument();
  });

  it("renders the pluralized footer for 0 / 1 / N", () => {
    const { rerender } = render(<SharedInfoCard visibleItemCount={0} />);
    expect(
      screen.getByText(/No portfolio items are ready yet/),
    ).toBeInTheDocument();

    rerender(<SharedInfoCard visibleItemCount={1} />);
    expect(
      screen.getByText(/1 portfolio item is ready to appear once you turn this on\./),
    ).toBeInTheDocument();

    rerender(<SharedInfoCard visibleItemCount={3} />);
    expect(
      screen.getByText(/3 portfolio items are ready to appear once you turn this on\./),
    ).toBeInTheDocument();
  });
});
