import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
  return { ...actual, listClubMatches: vi.fn() };
});
vi.mock("@/lib/api/sponsorship", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/sponsorship")>("@/lib/api/sponsorship");
  return { ...actual, getGoalSet: vi.fn() };
});

import { useSession } from "next-auth/react";
import { listClubMatches } from "@/lib/api/matching";
import { getGoalSet } from "@/lib/api/sponsorship";
import { ApiError } from "@/lib/api/errors";
import { makeGoalSet } from "@/components/sponsorship/test-fixtures";
import {
  ACCESS_TOKEN,
  makeClubMatch,
} from "@/components/matching/test-fixtures";
import { makeClubSummary } from "@/components/clubs/test-fixtures";

import GoalSetMatchesPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Organization" },
    status: "authenticated",
  } as never);
  vi.mocked(getGoalSet).mockResolvedValue(makeGoalSet());
  vi.mocked(listClubMatches).mockResolvedValue({
    items: [
      makeClubMatch({
        club: makeClubSummary({
          fieldsOfStudy: ["Computer Science", "Statistics", "Marketing", "Design"],
        }),
      }),
      makeClubMatch({
        fit: "Partial",
        reasons: ["One", "Two", "Three", "Four", "Five"],
        club: makeClubSummary({ id: "club-2", name: "Robotics Club", memberCount: 1 }),
      }),
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("goal set matches page", () => {
  it("shows the goal set in the header, a skeleton, then club cards", async () => {
    render(<GoalSetMatchesPage />);
    expect(screen.getByText("Loading clubs.")).toBeInTheDocument();
    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(await screen.findByText("Campus hiring")).toBeInTheDocument();
    expect(screen.getByText(/Acme Ltd/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sponsorship goals/ })).toHaveAttribute(
      "href",
      "/employer/sponsorship",
    );
    expect(listClubMatches).toHaveBeenCalledWith(ACCESS_TOKEN, "goal-1", "", expect.anything());
  });

  it("shows the band, reasons, facts and link on a card", async () => {
    render(<GoalSetMatchesPage />);
    const [first] = await screen.findAllByRole("article");
    expect(within(first).getByRole("heading", { name: "Data Science Club" })).toBeInTheDocument();
    expect(within(first).getByText("BUET")).toBeInTheDocument();
    expect(within(first).getByText("Strong fit")).toBeInTheDocument();
    expect(within(first).getByText("Reaches Computer Science students.")).toBeInTheDocument();
    expect(within(first).getByText("120 members")).toBeInTheDocument();
    expect(within(first).getByText("Marketing")).toBeInTheDocument();
    expect(within(first).queryByText("Design")).not.toBeInTheDocument();
    expect(within(first).getByText("+1 more")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: /View club/ })).toHaveAttribute(
      "href",
      "/employer/clubs/club-1",
    );
  });

  it("shows at most four reasons", async () => {
    render(<GoalSetMatchesPage />);
    const cards = await screen.findAllByRole("article");
    const second = cards[1];
    expect(within(second).getByText("Partial fit")).toBeInTheDocument();
    expect(within(within(second).getByRole("list", { name: "Why it fits" })).getAllByRole("listitem")).toHaveLength(4);
    expect(within(second).queryByText("Five")).not.toBeInTheDocument();
  });

  it("searches after a pause in typing and clears with the clear button", async () => {
    render(<GoalSetMatchesPage />);
    await screen.findAllByRole("article");
    vi.useFakeTimers();
    const box = screen.getByLabelText("Describe the club you want, in your own words");
    fireEvent.change(box, { target: { value: "hackathon " } });
    fireEvent.change(box, { target: { value: "hackathon computer science year 2" } });
    expect(listClubMatches).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(listClubMatches).toHaveBeenCalledTimes(2);
    expect(listClubMatches).toHaveBeenLastCalledWith(
      ACCESS_TOKEN,
      "goal-1",
      "hackathon computer science year 2",
      expect.anything(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(listClubMatches).toHaveBeenLastCalledWith(ACCESS_TOKEN, "goal-1", "", expect.anything());
    expect(box).toHaveValue("");
  });

  it("shows the no suggestions state", async () => {
    vi.mocked(listClubMatches).mockResolvedValue({ items: [] });
    render(<GoalSetMatchesPage />);
    expect(await screen.findByText("No suggestions yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("shows the no search results state with a way to clear", async () => {
    render(<GoalSetMatchesPage />);
    await screen.findAllByRole("article");
    vi.mocked(listClubMatches).mockResolvedValue({ items: [] });
    fireEvent.change(screen.getByLabelText(/Describe the club/), { target: { value: "chess" } });
    expect(await screen.findByText("No clubs match your words.")).toBeInTheDocument();
    vi.mocked(listClubMatches).mockResolvedValue({ items: [makeClubMatch()] });
    fireEvent.click(screen.getAllByRole("button", { name: "Clear search" })[1]);
    expect(await screen.findByRole("article")).toBeInTheDocument();
    expect(screen.getByLabelText(/Describe the club/)).toHaveValue("");
  });

  it("shows an error with retry", async () => {
    vi.mocked(listClubMatches).mockRejectedValueOnce(new Error("x"));
    render(<GoalSetMatchesPage />);
    expect(await screen.findByText("Could not load clubs")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect((await screen.findAllByRole("article")).length).toBeGreaterThan(0);
  });

  it("keeps the list and offers retry when a later search fails", async () => {
    render(<GoalSetMatchesPage />);
    await screen.findAllByRole("article");
    vi.mocked(listClubMatches).mockRejectedValueOnce(new Error("x"));
    fireEvent.change(screen.getByLabelText(/Describe the club/), { target: { value: "robots" } });
    expect(await screen.findByText(/Could not update the list/)).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("shows a message under the search box for a too long query", async () => {
    render(<GoalSetMatchesPage />);
    await screen.findAllByRole("article");
    vi.mocked(listClubMatches).mockRejectedValueOnce(
      new ApiError("sponsorship_match_query_invalid", "x", 400),
    );
    fireEvent.change(screen.getByLabelText(/Describe the club/), { target: { value: "long" } });
    expect(await screen.findByText(/Your search is too long/)).toBeInTheDocument();
  });

  it("shows not found when the goal set is gone", async () => {
    vi.mocked(getGoalSet).mockRejectedValue(new ApiError("sponsorship_goal_not_found", "x", 404));
    vi.mocked(listClubMatches).mockRejectedValue(
      new ApiError("sponsorship_goal_not_found", "x", 404),
    );
    render(<GoalSetMatchesPage />);
    expect(await screen.findByText("Goal set not found")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Describe the club/)).not.toBeInTheDocument();
  });
});
