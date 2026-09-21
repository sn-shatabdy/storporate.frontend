import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StudentNav } from "./header";

/**
 * Tests for the Student-only nav links (STOR-43 Phase 3 add). Asserts:
 *   - "Visibility" link points at /dashboard/visibility.
 *   - The link carries aria-current="page" when isVisibilityActive is true.
 *   - The other links keep their existing behavior (Dashboard / My
 *     Portfolio / Advisor) so we don't regress the active styling on
 *     the other nav items while adding the new one.
 */

describe("StudentNav", () => {
  it("renders a Visibility link to /dashboard/visibility", () => {
    render(
      <StudentNav
        isDashboardActive={false}
        isPortfolioActive={false}
        isAdvisorActive={false}
        isVisibilityActive={false}
      />,
    );
    const link = screen.getByRole("link", { name: "Visibility" });
    expect(link).toHaveAttribute("href", "/dashboard/visibility");
  });

  it("marks Visibility as the active page when isVisibilityActive is true", () => {
    render(
      <StudentNav
        isDashboardActive={false}
        isPortfolioActive={false}
        isAdvisorActive={false}
        isVisibilityActive={true}
      />,
    );
    const link = screen.getByRole("link", { name: "Visibility" });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("does NOT mark Visibility as active when isVisibilityActive is false", () => {
    render(
      <StudentNav
        isDashboardActive={false}
        isPortfolioActive={false}
        isAdvisorActive={false}
        isVisibilityActive={false}
      />,
    );
    const link = screen.getByRole("link", { name: "Visibility" });
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("still renders Dashboard, My Portfolio, and Advisor links", () => {
    render(
      <StudentNav
        isDashboardActive={true}
        isPortfolioActive={false}
        isAdvisorActive={false}
        isVisibilityActive={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "My Portfolio" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Advisor" })).toBeInTheDocument();
    // Dashboard should be the active one.
    expect(
      screen.getByRole("link", { name: "Dashboard" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("renders an Openings link to /dashboard/jobs and marks it active", () => {
    const { rerender } = render(
      <StudentNav
        isDashboardActive={false}
        isPortfolioActive={false}
        isAdvisorActive={false}
        isVisibilityActive={false}
      />,
    );
    const link = screen.getByRole("link", { name: "Openings" });
    expect(link).toHaveAttribute("href", "/dashboard/jobs");
    expect(link).not.toHaveAttribute("aria-current");
    rerender(
      <StudentNav
        isDashboardActive={false}
        isPortfolioActive={false}
        isAdvisorActive={false}
        isVisibilityActive={false}
        isOpeningsActive={true}
      />,
    );
    expect(screen.getByRole("link", { name: "Openings" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders an Applications link to /dashboard/applications and marks it active", () => {
    const { rerender } = render(
      <StudentNav
        isDashboardActive={false}
        isPortfolioActive={false}
        isAdvisorActive={false}
        isVisibilityActive={false}
      />,
    );
    const link = screen.getByRole("link", { name: "Applications" });
    expect(link).toHaveAttribute("href", "/dashboard/applications");
    expect(link).not.toHaveAttribute("aria-current");
    rerender(
      <StudentNav
        isDashboardActive={false}
        isPortfolioActive={false}
        isAdvisorActive={false}
        isVisibilityActive={false}
        isApplicationsActive={true}
      />,
    );
    expect(screen.getByRole("link", { name: "Applications" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
