import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { SharedInfoCard } from "./shared-info-card";

/**
 * Tests for the off-state info card. Confirms the two columns, the new
 * STOR-44 Phase 3 "Shared only if you choose" sub-heading, the
 * per-item-toggle call-out under the columns, and the pluralized footer
 * line render with the correct copy.
 */

describe("SharedInfoCard", () => {
  it("renders the 'Shared when on', 'Shared only if you choose', and 'Never shared' headings", () => {
    render(<SharedInfoCard visibleItemCount={0} />);
    expect(screen.getByText("Shared when on")).toBeInTheDocument();
    expect(screen.getByText("Shared only if you choose")).toBeInTheDocument();
    expect(screen.getByText("Never shared")).toBeInTheDocument();
    expect(screen.getByText("Your display name")).toBeInTheDocument();
    expect(screen.getByText("Your email address")).toBeInTheDocument();
  });

  it("lists files/links under 'Shared only if you choose' and removes them from 'Never shared'", () => {
    render(<SharedInfoCard visibleItemCount={0} />);
    expect(
      screen.getByText("Original files and links, item by item"),
    ).toBeInTheDocument();
    // "Your files and links" is gone — files/links are now opt-in per
    // item (STOR-44 Phase 3), not strictly off-limits.
    expect(screen.queryByText(/^Your files and links$/)).not.toBeInTheDocument();
    // The "Never shared" column now lists email + descriptions only.
    expect(screen.getByText("Your item descriptions")).toBeInTheDocument();
  });

  it("renders the per-item-toggle call-out under the two columns", () => {
    render(<SharedInfoCard visibleItemCount={0} />);
    expect(
      screen.getByText(
        /You can also let employers open the original file or link of an item\. Choose this item by item in your portfolio\./,
      ),
    ).toBeInTheDocument();
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
