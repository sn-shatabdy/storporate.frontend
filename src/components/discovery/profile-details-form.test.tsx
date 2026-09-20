import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";

import type { ProfileDraft } from "./helpers";

import { ProfileDetailsForm } from "./profile-details-form";

/**
 * Tests for the on-state details form. Pins:
 *   - The display name input is reachable by ref (so the page can focus
 *     it after a failed save).
 *   - Each per-field Show switch toggles its own boolean.
 *   - Field-level errors render under the right input and mark it
 *     `aria-invalid="true"`.
 *   - The study-year select maps "Not set" to `null` and "Year N" to N.
 */

const DRAFT: ProfileDraft = {
  isSearchable: true,
  displayName: "Nadia",
  headline: "",
  university: "",
  fieldOfStudy: "",
  studyYear: null,
  showHeadline: true,
  showUniversity: true,
  showFieldOfStudy: true,
  showStudyYear: true,
};

describe("ProfileDetailsForm", () => {
  it("forwards a ref to the display name input so the page can focus it", () => {
    const ref = createRef<HTMLInputElement>();
    render(
      <ProfileDetailsForm
        ref={ref}
        draft={DRAFT}
        errors={{}}
        onDisplayNameChange={() => {}}
        onHeadlineChange={() => {}}
        onUniversityChange={() => {}}
        onFieldOfStudyChange={() => {}}
        onStudyYearChange={() => {}}
        onShowHeadlineChange={() => {}}
        onShowUniversityChange={() => {}}
        onShowFieldOfStudyChange={() => {}}
        onShowStudyYearChange={() => {}}
      />,
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.id).toBe("visibility-display-name");
  });

  it("renders a Show switch for each optional field, each with its own aria-label", () => {
    render(
      <ProfileDetailsForm
        draft={DRAFT}
        errors={{}}
        onDisplayNameChange={() => {}}
        onHeadlineChange={() => {}}
        onUniversityChange={() => {}}
        onFieldOfStudyChange={() => {}}
        onStudyYearChange={() => {}}
        onShowHeadlineChange={() => {}}
        onShowUniversityChange={() => {}}
        onShowFieldOfStudyChange={() => {}}
        onShowStudyYearChange={() => {}}
      />,
    );
    expect(
      screen.getByRole("switch", { name: /Show headline/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /Show university/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /Show field of study/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /Show study year/i }),
    ).toBeInTheDocument();
  });

  it("calls the matching onShowChange handler with the toggled boolean", () => {
    const onShowUniversityChange = vi.fn();
    render(
      <ProfileDetailsForm
        draft={DRAFT}
        errors={{}}
        onDisplayNameChange={() => {}}
        onHeadlineChange={() => {}}
        onUniversityChange={() => {}}
        onFieldOfStudyChange={() => {}}
        onStudyYearChange={() => {}}
        onShowHeadlineChange={() => {}}
        onShowUniversityChange={onShowUniversityChange}
        onShowFieldOfStudyChange={() => {}}
        onShowStudyYearChange={() => {}}
      />,
    );
    const sw = screen.getByRole("switch", { name: /Show university/i });
    fireEvent.click(sw);
    expect(onShowUniversityChange).toHaveBeenCalledWith(false);
  });

  it("renders field-level errors under the matching input and marks it aria-invalid", () => {
    render(
      <ProfileDetailsForm
        draft={DRAFT}
        errors={{
          displayName: "display_name_required",
          university: "university_too_long",
        }}
        onDisplayNameChange={() => {}}
        onHeadlineChange={() => {}}
        onUniversityChange={() => {}}
        onFieldOfStudyChange={() => {}}
        onStudyYearChange={() => {}}
        onShowHeadlineChange={() => {}}
        onShowUniversityChange={() => {}}
        onShowFieldOfStudyChange={() => {}}
        onShowStudyYearChange={() => {}}
      />,
    );
    expect(screen.getByText("Enter a display name.")).toBeInTheDocument();
    expect(screen.getByText("Use 120 characters or fewer.")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Display name"),
    ).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByLabelText("University"),
    ).toHaveAttribute("aria-invalid", "true");
  });

  it("maps the study-year select: '' → null and '3' → 3", () => {
    const onStudyYearChange = vi.fn();
    render(
      <ProfileDetailsForm
        draft={DRAFT}
        errors={{}}
        onDisplayNameChange={() => {}}
        onHeadlineChange={() => {}}
        onUniversityChange={() => {}}
        onFieldOfStudyChange={() => {}}
        onStudyYearChange={onStudyYearChange}
        onShowHeadlineChange={() => {}}
        onShowUniversityChange={() => {}}
        onShowFieldOfStudyChange={() => {}}
        onShowStudyYearChange={() => {}}
      />,
    );
    const select = screen.getByLabelText(
      "Study year",
    ) as unknown as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "" } });
    expect(onStudyYearChange).toHaveBeenLastCalledWith(null);
    fireEvent.change(select, { target: { value: "3" } });
    expect(onStudyYearChange).toHaveBeenLastCalledWith(3);
  });
});
