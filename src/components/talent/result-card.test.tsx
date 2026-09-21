import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

// next/link is a regular anchor in jsdom; the default mock in vitest
// setup is enough for these assertions.
import type { TalentSearchResultItem } from "@/lib/api/talentSearch";

import { ResultCard } from "./result-card";

/**
 * Unit tests for the STOR-43/STOR-44 `ResultCard`. The page-level
 * search-page test exercises the broader integration; this file
 * pins the per-card contract:
 *   - The "View portfolio" link (added in STOR-44) renders with
 *     the correct href to the candidate drill-down route.
 *   - The link appears even when the cited-items block is hidden
 *     (i.e. when the candidate has no citations).
 */

const BASE_RESULT: TalentSearchResultItem = {
  candidateId: "cand-123",
  displayName: "Nadia Rahman",
  headline: "Data analyst with Power BI",
  university: "BUET",
  fieldOfStudy: "CSE",
  studyYear: 3,
  matchedSkills: [
    { name: "Power BI", band: "Strong" },
    { name: "Excel", band: "Developing" },
  ],
  reason: "Has built Power BI dashboards from messy sales data.",
  citedItems: [
    {
      portfolioItemId: "pi-1",
      label: "Sales dashboard 2025",
      category: "Project",
      skillName: "Power BI",
      band: "Strong",
    },
  ],
};

describe("ResultCard — View portfolio link (STOR-44)", () => {
  it("renders a 'View portfolio' link with the correct href", () => {
    render(<ResultCard result={BASE_RESULT} />);

    const link = screen.getByRole("link", { name: /View portfolio/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/employer/candidates/cand-123");
  });

  it("uses the candidateId from the result, not any display-name slug", () => {
    render(
      <ResultCard
        result={{ ...BASE_RESULT, candidateId: "abc-DEF_123" }}
      />,
    );
    const link = screen.getByRole("link", { name: /View portfolio/i });
    expect(link).toHaveAttribute("href", "/employer/candidates/abc-DEF_123");
  });

  it("renders the link even when there are no cited items", () => {
    render(
      <ResultCard
        result={{ ...BASE_RESULT, citedItems: [] }}
      />,
    );
    expect(screen.getByText("Nadia Rahman")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /View portfolio/i }),
    ).toHaveAttribute("href", "/employer/candidates/cand-123");
    // Cited block is gone.
    expect(screen.queryByText(/From their portfolio/i)).not.toBeInTheDocument();
  });

  it("the link is inside the card's <li> so the per-card layout is preserved", () => {
    const { container } = render(<ResultCard result={BASE_RESULT} />);
    const cardLi = container.querySelector("li");
    expect(cardLi).not.toBeNull();
    const link = screen.getByRole("link", { name: /View portfolio/i });
    expect(cardLi!.contains(link)).toBe(true);
  });
});
