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

describe("ClubNav sponsors link", () => {
  it("renders a Sponsors link to /club/sponsors next to My profile and marks it active", () => {
    const { rerender } = render(<ClubNav isProfileActive={false} />);
    const link = screen.getByRole("link", { name: "Sponsors" });
    expect(link).toHaveAttribute("href", "/club/sponsors");
    expect(link).not.toHaveAttribute("aria-current");
    const names = screen.getAllByRole("link").map((l) => l.textContent);
    expect(names).toEqual(["My profile", "Sponsors", "Matches"]);
    rerender(<ClubNav isProfileActive={false} isSponsorsActive />);
    expect(screen.getByRole("link", { name: "Sponsors" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "My profile" })).not.toHaveAttribute("aria-current");
  });
});

describe("EmployerNav sponsorship link", () => {
  it("renders a Sponsorship link to /employer/sponsorship and marks it active", () => {
    const { rerender } = render(<EmployerNav isSearchActive={false} />);
    const link = screen.getByRole("link", { name: "Sponsorship" });
    expect(link).toHaveAttribute("href", "/employer/sponsorship");
    expect(link).not.toHaveAttribute("aria-current");
    rerender(<EmployerNav isSearchActive={false} isSponsorshipActive />);
    expect(screen.getByRole("link", { name: "Sponsorship" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("ClubNav matches link", () => {
  it("renders a Matches link to /club/matches and marks it active", () => {
    const { rerender } = render(<ClubNav isProfileActive={false} />);
    const link = screen.getByRole("link", { name: "Matches" });
    expect(link).toHaveAttribute("href", "/club/matches");
    expect(link).not.toHaveAttribute("aria-current");
    rerender(<ClubNav isProfileActive={false} isMatchesActive />);
    expect(screen.getByRole("link", { name: "Matches" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Sponsors" })).not.toHaveAttribute("aria-current");
  });
});
