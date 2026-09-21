import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const pushMock = vi.fn();
const replaceMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => "/employer/sponsorship",
  useSearchParams: () => searchParamsValue,
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
    createGoalSet: vi.fn(),
    updateGoalSet: vi.fn(),
    setGoalSetStatus: vi.fn(),
    deleteGoalSet: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import {
  createGoalSet,
  deleteGoalSet,
  getGoalSet,
  listGoalSets,
  setGoalSetStatus,
  updateGoalSet,
} from "@/lib/api/sponsorship";
import { ApiError } from "@/lib/api/errors";
import EmployerLayout from "@/app/(employer)/layout";

import GoalSetsPage from "./page";
import NewGoalSetPage from "./new/page";
import EditGoalSetPage from "./[id]/edit/page";
import { ACCESS_TOKEN, makeGoalSet } from "@/components/sponsorship/test-fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  pushMock.mockReset();
  replaceMock.mockReset();
  searchParamsValue = new URLSearchParams();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Organization" },
    status: "authenticated",
  } as never);
  vi.mocked(listGoalSets).mockResolvedValue({ items: [makeGoalSet()] });
  vi.mocked(getGoalSet).mockResolvedValue(makeGoalSet());
});

afterEach(() => cleanup());

describe("sponsorship goal list", () => {
  it("shows a skeleton then the cards with budget, chips and status", async () => {
    render(<GoalSetsPage />);
    expect(screen.getByText("Loading your goal sets.")).toBeInTheDocument();
    const card = await screen.findByRole("article", { name: "Campus hiring" });
    expect(within(card).getByText("Acme Ltd", { exact: false })).toBeInTheDocument();
    expect(within(card).getByText("Active")).toBeInTheDocument();
    expect(within(card).getByText("Recruiting")).toBeInTheDocument();
    expect(within(card).getByText("Hackathon")).toBeInTheDocument();
    expect(within(card).getByText("BDT 50,000 to BDT 200,000")).toBeInTheDocument();
    expect(within(card).getByText(/Updated Sep 20, 2026/)).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/employer/sponsorship/goal-1/edit",
    );
    expect(listGoalSets).toHaveBeenCalledWith(ACCESS_TOKEN, expect.anything());
  });

  it("marks a hidden budget and a missing budget", async () => {
    vi.mocked(listGoalSets).mockResolvedValue({
      items: [
        makeGoalSet({ id: "a", name: "Hidden one", budget: { min: 1000, max: 5000, visibleToClubs: false } }),
        makeGoalSet({ id: "b", name: "No budget", budget: { min: null, max: null, visibleToClubs: false } }),
      ],
    });
    render(<GoalSetsPage />);
    const hidden = await screen.findByRole("article", { name: "Hidden one" });
    expect(within(hidden).getByText("Hidden from clubs")).toBeInTheDocument();
    const none = screen.getByRole("article", { name: "No budget" });
    expect(within(none).getByText("Budget not set")).toBeInTheDocument();
  });

  it("shows the empty state with a New goal set button", async () => {
    vi.mocked(listGoalSets).mockResolvedValue({ items: [] });
    render(<GoalSetsPage />);
    expect(await screen.findByText("No goal sets yet")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "New goal set" });
    expect(links.length).toBeGreaterThanOrEqual(2);
    expect(links[0]).toHaveAttribute("href", "/employer/sponsorship/new");
  });

  it("shows an error with retry", async () => {
    vi.mocked(listGoalSets).mockRejectedValueOnce(new Error("x"));
    render(<GoalSetsPage />);
    expect(await screen.findByText("Could not load your goal sets")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("article", { name: "Campus hiring" })).toBeInTheDocument();
    expect(listGoalSets).toHaveBeenCalledTimes(2);
  });

  it("pauses a goal set and resumes it", async () => {
    vi.mocked(setGoalSetStatus).mockResolvedValueOnce(makeGoalSet({ status: "Paused" }));
    vi.mocked(setGoalSetStatus).mockResolvedValueOnce(makeGoalSet({ status: "Active" }));
    render(<GoalSetsPage />);
    const card = await screen.findByRole("article", { name: "Campus hiring" });
    fireEvent.click(within(card).getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(within(card).getByText("Paused")).toBeInTheDocument());
    expect(setGoalSetStatus).toHaveBeenCalledWith(ACCESS_TOKEN, "goal-1", "Paused");
    fireEvent.click(within(card).getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(within(card).getByText("Active")).toBeInTheDocument());
    expect(setGoalSetStatus).toHaveBeenLastCalledWith(ACCESS_TOKEN, "goal-1", "Active");
  });

  it("keeps the old status and shows an alert when pause fails", async () => {
    vi.mocked(setGoalSetStatus).mockRejectedValue(new Error("x"));
    render(<GoalSetsPage />);
    const card = await screen.findByRole("article", { name: "Campus hiring" });
    fireEvent.click(within(card).getByRole("button", { name: "Pause" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not update the goal set");
    expect(within(card).getByText("Active")).toBeInTheDocument();
  });

  it("asks before deleting and removes the card on confirm", async () => {
    vi.mocked(deleteGoalSet).mockResolvedValue(undefined);
    render(<GoalSetsPage />);
    const card = await screen.findByRole("article", { name: "Campus hiring" });
    fireEvent.click(within(card).getByRole("button", { name: "Delete" }));
    expect(deleteGoalSet).not.toHaveBeenCalled();
    expect(within(card).getByRole("alertdialog")).toHaveTextContent(/cannot be undone/);
    fireEvent.click(within(card).getByRole("button", { name: "Yes, delete it" }));
    await waitFor(() => expect(screen.queryByRole("article")).not.toBeInTheDocument());
    expect(deleteGoalSet).toHaveBeenCalledWith(ACCESS_TOKEN, "goal-1");
    expect(await screen.findByText("No goal sets yet")).toBeInTheDocument();
  });

  it("keeps the card when the delete is cancelled", async () => {
    render(<GoalSetsPage />);
    const card = await screen.findByRole("article", { name: "Campus hiring" });
    fireEvent.click(within(card).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(card).getByRole("button", { name: "Keep it" }));
    expect(within(card).queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(deleteGoalSet).not.toHaveBeenCalled();
  });

  it("shows an alert and keeps the card when delete fails", async () => {
    vi.mocked(deleteGoalSet).mockRejectedValue(new Error("x"));
    render(<GoalSetsPage />);
    const card = await screen.findByRole("article", { name: "Campus hiring" });
    fireEvent.click(within(card).getByRole("button", { name: "Delete" }));
    fireEvent.click(within(card).getByRole("button", { name: "Yes, delete it" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not delete the goal set");
    expect(screen.getByRole("article", { name: "Campus hiring" })).toBeInTheDocument();
  });

  it("shows the created line from the URL and clears it", async () => {
    searchParamsValue = new URLSearchParams("saved=created");
    render(<GoalSetsPage />);
    expect(await screen.findByText("Goal set created.")).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/employer/sponsorship");
  });
});

describe("new goal set page", () => {
  async function fillAndSave() {
    fireEvent.change(screen.getByLabelText("Goal set name"), { target: { value: "Campus hiring" } });
    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "Acme Ltd" } });
    fireEvent.click(screen.getByRole("button", { name: "Recruiting" }));
    fireEvent.click(screen.getByRole("button", { name: "Hackathon" }));
    fireEvent.click(screen.getByRole("button", { name: "Year 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));
  }

  it("creates and goes back to the list", async () => {
    vi.mocked(createGoalSet).mockResolvedValue(makeGoalSet());
    render(<NewGoalSetPage />);
    await fillAndSave();
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/employer/sponsorship?saved=created"));
    expect(createGoalSet).toHaveBeenCalledWith(
      ACCESS_TOKEN,
      expect.objectContaining({ name: "Campus hiring", companyName: "Acme Ltd" }),
    );
  });

  it("stays on the page and shows the server message on a 400", async () => {
    vi.mocked(createGoalSet).mockRejectedValue(
      new ApiError("sponsorship_goal_audience_required", "raw", 400),
    );
    render(<NewGoalSetPage />);
    await fillAndSave();
    expect(await screen.findByRole("alert")).toHaveTextContent(/at least one field of study/);
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("edit goal set page", () => {
  it("loads the set into the form and saves with PUT", async () => {
    vi.mocked(updateGoalSet).mockResolvedValue(makeGoalSet({ name: "Renamed" }));
    render(<EditGoalSetPage />);
    const name = await screen.findByLabelText("Goal set name");
    expect(name).toHaveValue("Campus hiring");
    fireEvent.change(name, { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateGoalSet).toHaveBeenCalled());
    expect(updateGoalSet).toHaveBeenCalledWith(
      ACCESS_TOKEN,
      "goal-1",
      expect.objectContaining({ name: "Renamed" }),
    );
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved."));
  });

  it("shows not found for a missing set", async () => {
    vi.mocked(getGoalSet).mockRejectedValue(
      new ApiError("sponsorship_goal_not_found", "none", 404),
    );
    render(<EditGoalSetPage />);
    expect(await screen.findByText("Goal set not found")).toBeInTheDocument();
  });

  it("shows an error with retry for other failures", async () => {
    vi.mocked(getGoalSet).mockRejectedValueOnce(new Error("x"));
    render(<EditGoalSetPage />);
    expect(await screen.findByText("Could not load this goal set")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByLabelText("Goal set name")).toBeInTheDocument();
  });
});

describe("employer guard", () => {
  it("does not render the pages for a Club account", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: ACCESS_TOKEN, actorType: "Club" },
      status: "authenticated",
    } as never);
    render(
      <EmployerLayout>
        <GoalSetsPage />
      </EmployerLayout>,
    );
    expect(screen.queryByText("Sponsorship goals")).not.toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/");
    expect(listGoalSets).not.toHaveBeenCalled();
  });
});
