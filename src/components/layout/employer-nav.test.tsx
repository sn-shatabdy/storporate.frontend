import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { EmployerNav } from "./header";

/**
 * Tests for the Organization-only nav links (STOR-43 Phase 4 add).
 * Mirrors `student-nav.test.tsx`'s structure so the two role-gated
 * nav components are tested with the same shape.
 *
 * Asserts:
 *   - "Search" link points at /employer/search.
 *   - The link carries aria-current="page" when isSearchActive is true.
 *   - The link does NOT carry aria-current when isSearchActive is false.
 */

describe("EmployerNav", () => {
  it("renders a Search link to /employer/search", () => {
    render(<EmployerNav isSearchActive={false} />);
    const link = screen.getByRole("link", { name: "Search" });
    expect(link).toHaveAttribute("href", "/employer/search");
  });

  it("marks Search as the active page when isSearchActive is true", () => {
    render(<EmployerNav isSearchActive={true} />);
    const link = screen.getByRole("link", { name: "Search" });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("does NOT mark Search as active when isSearchActive is false", () => {
    render(<EmployerNav isSearchActive={false} />);
    const link = screen.getByRole("link", { name: "Search" });
    expect(link).not.toHaveAttribute("aria-current");
  });

  it("renders a Jobs link to /employer/jobs and marks it active", () => {
    const { rerender } = render(
      <EmployerNav isSearchActive={false} isJobsActive={false} />,
    );
    const link = screen.getByRole("link", { name: "Jobs" });
    expect(link).toHaveAttribute("href", "/employer/jobs");
    expect(link).not.toHaveAttribute("aria-current");
    rerender(<EmployerNav isSearchActive={false} isJobsActive={true} />);
    expect(screen.getByRole("link", { name: "Jobs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders Shortlist and Messages links and marks each active", () => {
    const { rerender } = render(<EmployerNav isSearchActive={false} />);
    expect(screen.getByRole("link", { name: "Shortlist" })).toHaveAttribute(
      "href",
      "/employer/shortlist",
    );
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "href",
      "/employer/messages",
    );
    expect(screen.getByRole("link", { name: "Shortlist" })).not.toHaveAttribute(
      "aria-current",
    );
    rerender(<EmployerNav isSearchActive={false} isShortlistActive />);
    expect(screen.getByRole("link", { name: "Shortlist" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    rerender(<EmployerNav isSearchActive={false} isMessagesActive />);
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
