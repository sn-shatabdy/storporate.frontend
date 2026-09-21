import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/employer/sponsorship",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: "goal-1" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api/matching", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/matching")>("@/lib/api/matching");
  return { ...actual, listClubMatches: vi.fn(), listCompanyMatches: vi.fn() };
});
vi.mock("@/lib/api/sponsorship", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/sponsorship")>("@/lib/api/sponsorship");
  return { ...actual, getGoalSet: vi.fn(), listGoalSets: vi.fn() };
});

import { useSession } from "next-auth/react";
import { listClubMatches, listCompanyMatches } from "@/lib/api/matching";
import { getGoalSet, listGoalSets } from "@/lib/api/sponsorship";
import { ApiError } from "@/lib/api/errors";
import { ClubNav } from "@/components/layout/header";
import { makeGoalSet } from "@/components/sponsorship/test-fixtures";
import GoalSetsPage from "@/app/(employer)/employer/sponsorship/page";
import GoalSetMatchesPage from "@/app/(employer)/employer/sponsorship/[id]/matches/page";
import ClubMatchesPage from "@/app/(club)/club/matches/page";

import { FitBadge } from "./fit-badge";
import { ACCESS_TOKEN, ALL_BANDS, makeClubMatch, makeCompanyMatch } from "./test-fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Organization" },
    status: "authenticated",
  } as never);
  vi.mocked(getGoalSet).mockResolvedValue(makeGoalSet());
  vi.mocked(listGoalSets).mockResolvedValue({ items: [makeGoalSet()] });
  vi.mocked(listClubMatches).mockResolvedValue({
    items: ALL_BANDS.map((fit, i) =>
      makeClubMatch({ fit, club: { ...makeClubMatch().club, id: `club-${i}` } }),
    ),
  });
  vi.mocked(listCompanyMatches).mockResolvedValue({
    items: ALL_BANDS.map((fit, i) =>
      makeCompanyMatch({ fit, company: { ...makeCompanyMatch().company, id: `goal-${i}` } }),
    ),
  });
});

afterEach(() => cleanup());

function assertCleanCopy(text: string) {
  expect(text.length).toBeGreaterThan(0);
  expect(text).not.toMatch(/evidence/i);
  expect(text).not.toMatch(/proof/i);
  expect(text).not.toMatch(/score/i);
  expect(text).not.toMatch(/[—–]/);
  expect(text).not.toMatch(/%/);
}

describe("matching copy guard", () => {
  it("fit badge for every band", () => {
    for (const band of ALL_BANDS) {
      const view = render(<FitBadge fit={band} />);
      assertCleanCopy(view.container.textContent ?? "");
      cleanup();
    }
  });

  it("company page, filled, no suggestions, no results, error and not found", async () => {
    const filled = render(<GoalSetMatchesPage />);
    await screen.findAllByRole("article");
    assertCleanCopy(filled.container.textContent ?? "");
    cleanup();

    vi.mocked(listClubMatches).mockResolvedValue({ items: [] });
    const empty = render(<GoalSetMatchesPage />);
    await screen.findByText("No suggestions yet.");
    assertCleanCopy(empty.container.textContent ?? "");
    fireEvent.change(screen.getByLabelText(/Describe the club/), { target: { value: "chess" } });
    await screen.findByText("No clubs match your words.");
    assertCleanCopy(empty.container.textContent ?? "");
    cleanup();

    vi.mocked(listClubMatches).mockRejectedValue(new Error("x"));
    const failed = render(<GoalSetMatchesPage />);
    await screen.findByText("Could not load clubs");
    assertCleanCopy(failed.container.textContent ?? "");
    cleanup();

    vi.mocked(listClubMatches).mockRejectedValue(
      new ApiError("sponsorship_goal_not_found", "x", 404),
    );
    const missing = render(<GoalSetMatchesPage />);
    await screen.findByText("Goal set not found");
    assertCleanCopy(missing.container.textContent ?? "");
  });

  it("club page, filled, no suggestions, no results, error and profile states", async () => {
    const filled = render(<ClubMatchesPage />);
    await screen.findAllByRole("article");
    assertCleanCopy(filled.container.textContent ?? "");
    cleanup();

    vi.mocked(listCompanyMatches).mockResolvedValue({ items: [] });
    const empty = render(<ClubMatchesPage />);
    await screen.findByText("No suggestions yet.");
    assertCleanCopy(empty.container.textContent ?? "");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "chess" } });
    await screen.findByText("No companies match your words.");
    assertCleanCopy(empty.container.textContent ?? "");
    cleanup();

    vi.mocked(listCompanyMatches).mockRejectedValue(new Error("x"));
    const failed = render(<ClubMatchesPage />);
    await screen.findByText("Could not load companies");
    assertCleanCopy(failed.container.textContent ?? "");
    cleanup();

    vi.mocked(listCompanyMatches).mockRejectedValue(
      new ApiError("club_profile_not_found", "x", 404),
    );
    const none = render(<ClubMatchesPage />);
    await screen.findByText("No club profile yet.");
    assertCleanCopy(none.container.textContent ?? "");
    cleanup();

    vi.mocked(listCompanyMatches).mockRejectedValue(
      new ApiError("club_profile_not_published", "x", 409),
    );
    const draft = render(<ClubMatchesPage />);
    await screen.findByText("Your profile is a draft.");
    assertCleanCopy(draft.container.textContent ?? "");
  });

  it("goal set card link and club nav", async () => {
    const list = render(<GoalSetsPage />);
    await screen.findByRole("link", { name: /See matching clubs/ });
    assertCleanCopy(list.container.textContent ?? "");
    cleanup();
    const nav = render(<ClubNav isProfileActive={false} isMatchesActive />);
    assertCleanCopy(nav.container.textContent ?? "");
  });
});
