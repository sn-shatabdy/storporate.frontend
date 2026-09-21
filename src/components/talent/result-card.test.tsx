import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/api/outreach", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/outreach")>(
    "@/lib/api/outreach",
  );
  return {
    ...actual,
    addToShortlist: vi.fn(),
    removeFromShortlist: vi.fn(),
    startOutreach: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import {
  addToShortlist,
  removeFromShortlist,
  startOutreach,
  type ShortlistEntry,
} from "@/lib/api/outreach";

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

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: "test-token" },
    status: "authenticated",
  } as never);
});

afterEach(() => cleanup());

function makeEntry(overrides: Partial<ShortlistEntry> = {}): ShortlistEntry {
  return {
    candidateId: "cand-123",
    displayName: "Nadia Rahman",
    headline: null,
    university: null,
    fieldOfStudy: null,
    studyYear: null,
    available: true,
    savedAt: "2026-09-20T10:00:00Z",
    conversation: null,
    ...overrides,
  };
}

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

describe("ResultCard: shortlist and invite (STOR-68)", () => {
  it("saves to the shortlist, shows Saved, and can remove", async () => {
    vi.mocked(addToShortlist).mockResolvedValue(makeEntry());
    vi.mocked(removeFromShortlist).mockResolvedValue(undefined);
    render(<ResultCard result={BASE_RESULT} />);

    fireEvent.click(screen.getByRole("button", { name: "Save to shortlist" }));
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
    expect(addToShortlist).toHaveBeenCalledWith("test-token", "cand-123");

    fireEvent.click(screen.getByRole("button", { name: "Remove from shortlist" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save to shortlist" }),
      ).toBeInTheDocument(),
    );
    expect(removeFromShortlist).toHaveBeenCalledWith("test-token", "cand-123");
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("shows an inline error when saving fails and stays unsaved", async () => {
    vi.mocked(addToShortlist).mockRejectedValue(new Error("boom"));
    render(<ResultCard result={BASE_RESULT} />);
    fireEvent.click(screen.getByRole("button", { name: "Save to shortlist" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not save to your shortlist. Try again.",
    );
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("shows Open conversation instead of Invite when one already exists", async () => {
    vi.mocked(addToShortlist).mockResolvedValue(
      makeEntry({ conversation: { id: "conv-9", status: "Invited" } }),
    );
    render(<ResultCard result={BASE_RESULT} />);
    expect(screen.getByRole("button", { name: "Invite" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save to shortlist" }));
    const link = await screen.findByRole("link", { name: "Open conversation" });
    expect(link).toHaveAttribute("href", "/employer/messages/conv-9");
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument();
  });

  it("sends an invitation from the panel and shows the status line", async () => {
    vi.mocked(startOutreach).mockResolvedValue({
      id: "conv-1",
      counterpartName: "Nadia Rahman",
      status: "Invited",
      lastMessagePreview: "Hello",
      lastMessageAt: "2026-09-20T10:00:00Z",
      updatedAt: "2026-09-20T10:00:00Z",
      messages: [],
    });
    render(<ResultCard result={BASE_RESULT} />);
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));
    fireEvent.change(screen.getByLabelText("Your organization"), {
      target: { value: "Acme Analytics" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "We liked your dashboard." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Invitation sent.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open the conversation" }),
    ).toHaveAttribute("href", "/employer/messages/conv-1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
