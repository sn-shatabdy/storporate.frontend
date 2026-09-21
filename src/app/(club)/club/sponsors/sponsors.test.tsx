import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const replaceMock = vi.fn();

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
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
  return { ...actual, listCompanyGoals: vi.fn(), getCompanyGoal: vi.fn() };
});

import { useSession } from "next-auth/react";
import { getCompanyGoal, listCompanyGoals } from "@/lib/api/sponsorship";
import { ApiError } from "@/lib/api/errors";
import ClubLayout from "@/app/(club)/layout";

import SponsorsPage from "./page";
import SponsorDetailPage from "./[id]/page";
import { ACCESS_TOKEN, makeDetail, makeSummary } from "@/components/sponsorship/test-fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  replaceMock.mockReset();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Club" },
    status: "authenticated",
  } as never);
  vi.mocked(listCompanyGoals).mockResolvedValue({ items: [makeSummary()] });
  vi.mocked(getCompanyGoal).mockResolvedValue(makeDetail());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("club sponsors list", () => {
  it("shows a skeleton then the cards", async () => {
    render(<SponsorsPage />);
    expect(screen.getByText("Loading sponsors.")).toBeInTheDocument();
    const card = await screen.findByRole("article");
    expect(within(card).getByRole("heading", { name: "Acme Ltd" })).toBeInTheDocument();
    expect(within(card).getByText("Campus hiring")).toBeInTheDocument();
    expect(within(card).getByText("Recruiting")).toBeInTheDocument();
    expect(within(card).getByText("Hackathon")).toBeInTheDocument();
    expect(within(card).getByText("BDT 50,000 to BDT 200,000")).toBeInTheDocument();
    expect(card.closest("a")).toHaveAttribute("href", "/club/sponsors/goal-1");
    expect(listCompanyGoals).toHaveBeenCalledWith(ACCESS_TOKEN, {}, expect.anything());
  });

  it("shows the first three fields of study and a more count", async () => {
    render(<SponsorsPage />);
    const card = await screen.findByRole("article");
    expect(within(card).getByText("Computer Science")).toBeInTheDocument();
    expect(within(card).getByText("Marketing")).toBeInTheDocument();
    expect(within(card).queryByText("Design")).not.toBeInTheDocument();
    expect(within(card).getByText("+1 more")).toBeInTheDocument();
  });

  it("formats one sided budgets and hides a missing one", async () => {
    vi.mocked(listCompanyGoals).mockResolvedValue({
      items: [
        makeSummary({ id: "a", companyName: "From Co", budget: { min: 10000, max: null } }),
        makeSummary({ id: "b", companyName: "Up Co", budget: { min: null, max: 90000 } }),
        makeSummary({ id: "c", companyName: "None Co", budget: null }),
      ],
    });
    render(<SponsorsPage />);
    expect(await screen.findByText("From BDT 10,000")).toBeInTheDocument();
    expect(screen.getByText("Up to BDT 90,000")).toBeInTheDocument();
    const none = screen.getByRole("heading", { name: "None Co" }).closest("article")!;
    expect(within(none).queryByText(/BDT/)).not.toBeInTheDocument();
  });

  it("refetches with the chosen filters after a pause in typing", async () => {
    render(<SponsorsPage />);
    await screen.findByRole("article");
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "acme" } });
    fireEvent.change(screen.getByLabelText("Objective"), { target: { value: "Recruiting" } });
    fireEvent.change(screen.getByLabelText("Event kind"), { target: { value: "Hackathon" } });
    expect(listCompanyGoals).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(listCompanyGoals).toHaveBeenCalledTimes(2);
    expect(listCompanyGoals).toHaveBeenLastCalledWith(
      ACCESS_TOKEN,
      { q: "acme", objective: "Recruiting", eventKind: "Hackathon" },
      expect.anything(),
    );
  });

  it("offers every fixed objective and event kind plus All", async () => {
    render(<SponsorsPage />);
    await screen.findByRole("article");
    const objective = screen.getByLabelText("Objective");
    expect(within(objective).getAllByRole("option")).toHaveLength(7);
    expect(within(objective).getByRole("option", { name: "All" })).toBeInTheDocument();
    const kind = screen.getByLabelText("Event kind");
    expect(within(kind).getAllByRole("option")).toHaveLength(9);
  });

  it("shows the no results state with Clear filters, which resets the filters", async () => {
    render(<SponsorsPage />);
    await screen.findByRole("article");
    vi.mocked(listCompanyGoals).mockResolvedValue({ items: [] });
    fireEvent.change(screen.getByLabelText("Objective"), { target: { value: "Recruiting" } });
    expect(await screen.findByText("No sponsors match.")).toBeInTheDocument();
    vi.mocked(listCompanyGoals).mockResolvedValue({ items: [makeSummary()] });
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(await screen.findByRole("article")).toBeInTheDocument();
    expect(screen.getByLabelText("Objective")).toHaveValue("");
  });

  it("shows the plain empty state when nothing is filtered", async () => {
    vi.mocked(listCompanyGoals).mockResolvedValue({ items: [] });
    render(<SponsorsPage />);
    expect(await screen.findByText("No sponsors yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    vi.mocked(listCompanyGoals).mockRejectedValueOnce(new Error("x"));
    render(<SponsorsPage />);
    expect(await screen.findByText("Could not load sponsors")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("article")).toBeInTheDocument();
  });
});

describe("club sponsor detail", () => {
  it("shows the company, audience, events, budget and notes", async () => {
    render(<SponsorDetailPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Acme Ltd" })).toBeInTheDocument();
    expect(screen.getByText("Campus hiring")).toBeInTheDocument();
    expect(screen.getByText("BDT 50,000 to BDT 200,000")).toBeInTheDocument();
    expect(screen.getByText("Year 3")).toBeInTheDocument();
    expect(screen.getByText("Year 4")).toBeInTheDocument();
    expect(screen.getByText("Dhaka")).toBeInTheDocument();
    expect(screen.getByText("BUET")).toBeInTheDocument();
    expect(screen.getByText("Hackathon")).toBeInTheDocument();
    expect(screen.getByText("We can send mentors.")).toBeInTheDocument();
    expect(screen.getByText(/Updated Sep 20, 2026/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sponsors" })).toHaveAttribute("href", "/club/sponsors");
    expect(getCompanyGoal).toHaveBeenCalledWith(ACCESS_TOKEN, "goal-1", expect.anything());
  });

  it("leaves out the budget and notes when absent", async () => {
    vi.mocked(getCompanyGoal).mockResolvedValue(makeDetail({ budget: null, notes: null }));
    render(<SponsorDetailPage />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByText(/BDT/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Notes" })).not.toBeInTheDocument();
  });

  it("shows the not found state for a 404", async () => {
    vi.mocked(getCompanyGoal).mockRejectedValue(
      new ApiError("sponsorship_goal_not_found", "none", 404),
    );
    render(<SponsorDetailPage />);
    expect(await screen.findByText("This goal set is not available.")).toBeInTheDocument();
  });

  it("shows an error with retry for other failures", async () => {
    vi.mocked(getCompanyGoal).mockRejectedValueOnce(new Error("x"));
    render(<SponsorDetailPage />);
    expect(await screen.findByText("Could not load this goal set")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(getCompanyGoal).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});

describe("club guard", () => {
  it("does not render the pages for an Organization account", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: ACCESS_TOKEN, actorType: "Organization" },
      status: "authenticated",
    } as never);
    render(
      <ClubLayout>
        <SponsorsPage />
      </ClubLayout>,
    );
    expect(screen.queryByRole("heading", { name: "Sponsors" })).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/");
    expect(listCompanyGoals).not.toHaveBeenCalled();
  });
});
