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
vi.mock("@/lib/api/sponsorship", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/sponsorship")>("@/lib/api/sponsorship");
  return {
    ...actual,
    listGoalSets: vi.fn(),
    getGoalSet: vi.fn(),
    listCompanyGoals: vi.fn(),
    getCompanyGoal: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import {
  getCompanyGoal,
  getGoalSet,
  listCompanyGoals,
  listGoalSets,
} from "@/lib/api/sponsorship";
import { ApiError } from "@/lib/api/errors";

import GoalSetsPage from "@/app/(employer)/employer/sponsorship/page";
import NewGoalSetPage from "@/app/(employer)/employer/sponsorship/new/page";
import EditGoalSetPage from "@/app/(employer)/employer/sponsorship/[id]/edit/page";
import SponsorsPage from "@/app/(club)/club/sponsors/page";
import SponsorDetailPage from "@/app/(club)/club/sponsors/[id]/page";
import { ClubNav, EmployerNav } from "@/components/layout/header";

import { ACCESS_TOKEN, makeDetail, makeGoalSet, makeSummary } from "./test-fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Organization" },
    status: "authenticated",
  } as never);
  vi.mocked(listGoalSets).mockResolvedValue({
    items: [
      makeGoalSet(),
      makeGoalSet({ id: "goal-2", status: "Paused", budget: { min: null, max: null, visibleToClubs: false } }),
    ],
  });
  vi.mocked(getGoalSet).mockResolvedValue(makeGoalSet());
  vi.mocked(listCompanyGoals).mockResolvedValue({ items: [makeSummary()] });
  vi.mocked(getCompanyGoal).mockResolvedValue(makeDetail());
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

describe("sponsorship copy guard", () => {
  it("company list, filled, confirm, empty and error", async () => {
    const list = render(<GoalSetsPage />);
    await screen.findAllByRole("article");
    assertCleanCopy(list.container.textContent ?? "");
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    assertCleanCopy(list.container.textContent ?? "");
    cleanup();

    vi.mocked(listGoalSets).mockResolvedValue({ items: [] });
    const empty = render(<GoalSetsPage />);
    await screen.findByText("No goal sets yet");
    assertCleanCopy(empty.container.textContent ?? "");
    cleanup();

    vi.mocked(listGoalSets).mockRejectedValue(new Error("x"));
    const failed = render(<GoalSetsPage />);
    await screen.findByText("Could not load your goal sets");
    assertCleanCopy(failed.container.textContent ?? "");
  });

  it("goal form, empty and with errors", () => {
    const view = render(<NewGoalSetPage />);
    assertCleanCopy(view.container.textContent ?? "");
    fireEvent.change(screen.getByLabelText("Minimum (BDT)"), { target: { value: "500" } });
    fireEvent.change(screen.getByLabelText("Maximum (BDT)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));
    expect(screen.getByText(/at least one field of study/)).toBeInTheDocument();
    assertCleanCopy(view.container.textContent ?? "");
  });

  it("edit form and not found", async () => {
    const edit = render(<EditGoalSetPage />);
    await screen.findByDisplayValue("Campus hiring");
    assertCleanCopy(edit.container.textContent ?? "");
    cleanup();
    vi.mocked(getGoalSet).mockRejectedValue(new ApiError("sponsorship_goal_not_found", "x", 404));
    const missing = render(<EditGoalSetPage />);
    await screen.findByText("Goal set not found");
    assertCleanCopy(missing.container.textContent ?? "");
  });

  it("club list, empty, filtered empty and error", async () => {
    const list = render(<SponsorsPage />);
    await screen.findByRole("article");
    assertCleanCopy(list.container.textContent ?? "");
    cleanup();

    vi.mocked(listCompanyGoals).mockResolvedValue({ items: [] });
    const empty = render(<SponsorsPage />);
    await screen.findByText("No sponsors yet.");
    assertCleanCopy(empty.container.textContent ?? "");
    fireEvent.change(screen.getByLabelText("Objective"), { target: { value: "Recruiting" } });
    await screen.findByText("No sponsors match.");
    assertCleanCopy(empty.container.textContent ?? "");
    cleanup();

    vi.mocked(listCompanyGoals).mockRejectedValue(new Error("x"));
    const failed = render(<SponsorsPage />);
    await screen.findByText("Could not load sponsors");
    assertCleanCopy(failed.container.textContent ?? "");
  });

  it("club detail and not found", async () => {
    const detail = render(<SponsorDetailPage />);
    await screen.findByRole("heading", { level: 1 });
    assertCleanCopy(detail.container.textContent ?? "");
    cleanup();
    vi.mocked(getCompanyGoal).mockRejectedValue(new ApiError("sponsorship_goal_not_found", "x", 404));
    const missing = render(<SponsorDetailPage />);
    await screen.findByText("This goal set is not available.");
    assertCleanCopy(missing.container.textContent ?? "");
  });

  it("navs", () => {
    const nav = render(
      <>
        <EmployerNav isSearchActive={false} isSponsorshipActive />
        <ClubNav isProfileActive={false} isSponsorsActive />
      </>,
    );
    assertCleanCopy(nav.container.textContent ?? "");
  });
});
