import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { ClubNav, EmployerNav } from "./header";

describe("ClubNav", () => {
  it("renders a My profile link to /club/profile", () => {
    render(<ClubNav isProfileActive={false} />);
    const link = screen.getByRole("link", { name: "My profile" });
    expect(link).toHaveAttribute("href", "/club/profile");
    expect(link).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("navigation", { name: "Club navigation" })).toBeInTheDocument();
  });

  it("marks My profile as the active page", () => {
    render(<ClubNav isProfileActive />);
    expect(screen.getByRole("link", { name: "My profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("EmployerNav clubs link", () => {
  it("renders a Clubs link to /employer/clubs and marks it active", () => {
    const { rerender } = render(<EmployerNav isSearchActive={false} />);
    const link = screen.getByRole("link", { name: "Clubs" });
    expect(link).toHaveAttribute("href", "/employer/clubs");
    expect(link).not.toHaveAttribute("aria-current");
    rerender(<EmployerNav isSearchActive={false} isClubsActive />);
    expect(screen.getByRole("link", { name: "Clubs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
