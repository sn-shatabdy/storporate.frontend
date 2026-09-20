import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import type { ProfileDraft } from "./helpers";

import { ProfilePreviewCard } from "./profile-preview-card";

/**
 * Tests for the preview card. Pins:
 *   - The name placeholder appears when the display name is empty.
 *   - The "Self-reported" pill only appears when at least one of the
 *     university/field/year parts is shown.
 *   - The portrait shows the initials of the display name.
 *   - Visible parts follow the show switches; hidden parts never appear.
 */

const BASE_DRAFT: ProfileDraft = {
  isSearchable: true,
  displayName: "Nadia Rahman",
  headline: "Data analysis with dbt",
  university: "BUET",
  fieldOfStudy: "CSE",
  studyYear: 3,
  showHeadline: true,
  showUniversity: true,
  showFieldOfStudy: true,
  showStudyYear: true,
};

describe("ProfilePreviewCard", () => {
  it("shows 'Your name' when the display name is empty", () => {
    render(
      <ProfilePreviewCard draft={{ ...BASE_DRAFT, displayName: "" }} visibleItemCount={0} />,
    );
    expect(screen.getByText("Your name")).toBeInTheDocument();
  });

  it("shows the Self-reported pill when at least one of university/field/year is shown", () => {
    render(<ProfilePreviewCard draft={BASE_DRAFT} visibleItemCount={1} />);
    expect(screen.getByText("Self-reported")).toBeInTheDocument();
  });

  it("hides the Self-reported pill when every part is hidden", () => {
    render(
      <ProfilePreviewCard
        draft={{
          ...BASE_DRAFT,
          showUniversity: false,
          showFieldOfStudy: false,
          showStudyYear: false,
        }}
        visibleItemCount={1}
      />,
    );
    expect(screen.queryByText("Self-reported")).not.toBeInTheDocument();
  });

  it("omits parts whose show switch is off", () => {
    render(
      <ProfilePreviewCard
        draft={{ ...BASE_DRAFT, showUniversity: false }}
        visibleItemCount={1}
      />,
    );
    expect(screen.queryByText("BUET")).not.toBeInTheDocument();
    expect(screen.getByText("CSE")).toBeInTheDocument();
    expect(screen.getByText("Year 3")).toBeInTheDocument();
  });

  it("uses the initials of the display name in the avatar tile", () => {
    const { container } = render(
      <ProfilePreviewCard draft={BASE_DRAFT} visibleItemCount={1} />,
    );
    expect(container.textContent).toContain("NR");
  });

  it("pluralizes the portfolio-items footer for 0 / 1 / N", () => {
    const { rerender } = render(
      <ProfilePreviewCard draft={BASE_DRAFT} visibleItemCount={0} />,
    );
    expect(
      screen.getByText(/once you have an analyzed item/),
    ).toBeInTheDocument();
    rerender(<ProfilePreviewCard draft={BASE_DRAFT} visibleItemCount={1} />);
    expect(screen.getByText(/1 portfolio item and its skills/)).toBeInTheDocument();
    rerender(<ProfilePreviewCard draft={BASE_DRAFT} visibleItemCount={3} />);
    expect(screen.getByText(/3 portfolio items and their skills/)).toBeInTheDocument();
  });
});
