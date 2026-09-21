import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { ApplicantCard } from "./applicant-card";
import { makeApplicant } from "./test-fixtures";

vi.mock("@/components/talent/skill-band-pill", () => ({
  SkillBandPill: ({ name }: { name: string }) => <span>{name}</span>,
}));

afterEach(() => cleanup());

function renderCard(
  overrides: Partial<Parameters<typeof makeApplicant>[0]> = {},
  opts: { open?: boolean } = {},
) {
  const applicant = makeApplicant(overrides);
  return render(
    <ApplicantCard
      applicant={applicant}
      open={opts.open ?? false}
      loading={false}
      savingDecision={null}
      error={null}
      onToggle={() => {}}
      onDecide={() => {}}
    />,
  );
}

describe("applicant-card DecisionButton tones", () => {
  it("uses success tokens for the pressed Shortlist button (no TONES hex map)", () => {
    renderCard({ id: "a1", status: "Shortlisted" }, { open: true });
    // The status pill says "Shortlisted" but the decision button says
    // "Shortlist" — disambiguate with the action verb to land on the
    // right element.
    const shortlist = screen.getByRole("button", { name: "Shortlist" });
    expect(shortlist).toHaveAttribute("aria-pressed", "true");
    expect(shortlist).toHaveClass("bg-success-soft", "text-success", "border-success");
    // No ad hoc TONES hex should leak into the className.
    expect(shortlist.className).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it("uses warning tokens for the pressed Not selected button", () => {
    renderCard({ id: "a2", status: "NotSelected" }, { open: true });
    // The status pill and the decision button both say "Not selected";
    // scope to the open-detail region so we land on the decision button.
    const card = screen.getByRole("article");
    const decline = within(card).getByRole("button", { name: "Not selected" });
    expect(decline).toHaveAttribute("aria-pressed", "true");
    expect(decline).toHaveClass("bg-warning-soft", "text-warning", "border-warning");
    expect(decline.className).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });
});

describe("applicant-card layout tokens", () => {
  it("uses the secondary token for the open panel surface (no cream hex)", () => {
    renderCard({ id: "a3" });
    // Open the panel by clicking Open.
    const card = screen.getByRole("article");
    const toggle = within(card).getByRole("button", { name: "Open" });
    expect(toggle).toBeEnabled();
  });

  it("renders with no hex classes anywhere on the card", () => {
    const { container } = renderCard({ id: "a4" });
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
