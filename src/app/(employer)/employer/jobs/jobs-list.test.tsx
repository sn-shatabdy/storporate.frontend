import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const routerMock = { push: vi.fn(), replace: vi.fn() };
let searchParams = new URLSearchParams();

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/employer/jobs",
  useSearchParams: () => searchParams,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api/jobPostings", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/jobPostings")>(
    "@/lib/api/jobPostings",
  );
  return { ...actual, listMyPostings: vi.fn(), setPostingStatus: vi.fn() };
});

import { useSession } from "next-auth/react";
import { listMyPostings, setPostingStatus } from "@/lib/api/jobPostings";
import { ACCESS_TOKEN, makePosting } from "@/components/jobs/test-fixtures";

import EmployerJobsPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  searchParams = new URLSearchParams();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Organization" },
    status: "authenticated",
  } as never);
});

afterEach(() => cleanup());

describe("employer openings list", () => {
  it("shows skeletons while loading", () => {
    vi.mocked(listMyPostings).mockReturnValue(new Promise(() => {}));
    render(<EmployerJobsPage />);
    expect(screen.getByText("Loading your openings.")).toBeInTheDocument();
  });

  it("shows the empty state with a Post an opening link", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({ items: [] });
    render(<EmployerJobsPage />);
    expect(await screen.findByText("No openings yet")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /Post an opening/ });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l).toHaveAttribute("href", "/employer/jobs/new");
  });

  it("renders cards with pills, skills and the right actions per status", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [
        makePosting({ id: "a", title: "Open one", status: "Open" }),
        makePosting({ id: "b", title: "Paused one", status: "Paused", kind: "Internship" }),
        makePosting({ id: "c", title: "Closed one", status: "Closed" }),
      ],
    });
    render(<EmployerJobsPage />);
    expect(await screen.findByText("Open one")).toBeInTheDocument();
    expect(listMyPostings).toHaveBeenCalledWith(ACCESS_TOKEN, expect.anything());
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Open");
    expect(cards[0]).toHaveTextContent("Job");
    expect(cards[0]).toHaveTextContent("Hybrid · Dhaka");
    expect(cards[0]).toHaveTextContent("Power BI");
    expect(cards[0].querySelector('a[href="/employer/jobs/a/edit"]')).toHaveTextContent("Edit");
    expect(cards[0]).toHaveTextContent("Pause");
    expect(cards[0]).toHaveTextContent("Close");
    expect(cards[1]).toHaveTextContent("Internship");
    expect(cards[1]).toHaveTextContent("Reopen");
    expect(cards[2].querySelector('a[href="/employer/jobs/c/edit"]')).toHaveTextContent("View");
    expect(within(cards[2]).queryByRole("button")).not.toBeInTheDocument();
  });

  it("pause calls the API once and updates the card", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({ items: [makePosting({ id: "a" })] });
    vi.mocked(setPostingStatus).mockResolvedValue(makePosting({ id: "a", status: "Paused" }));
    render(<EmployerJobsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Pause" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument());
    expect(setPostingStatus).toHaveBeenCalledTimes(1);
    expect(setPostingStatus).toHaveBeenCalledWith(ACCESS_TOKEN, "a", "Paused");
  });

  it("reopen calls the API once with Open", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [makePosting({ id: "a", status: "Paused" })],
    });
    vi.mocked(setPostingStatus).mockResolvedValue(makePosting({ id: "a", status: "Open" }));
    render(<EmployerJobsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument());
    expect(setPostingStatus).toHaveBeenCalledTimes(1);
    expect(setPostingStatus).toHaveBeenCalledWith(ACCESS_TOKEN, "a", "Open");
  });

  it("close needs a confirm step and can be cancelled", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({ items: [makePosting({ id: "a" })] });
    render(<EmployerJobsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(setPostingStatus).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("cannot be edited or reopened");
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(setPostingStatus).not.toHaveBeenCalled();
  });

  it("confirming close calls the API once with Closed", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({ items: [makePosting({ id: "a" })] });
    vi.mocked(setPostingStatus).mockResolvedValue(makePosting({ id: "a", status: "Closed" }));
    render(<EmployerJobsPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, close it" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(setPostingStatus).toHaveBeenCalledTimes(1);
    expect(setPostingStatus).toHaveBeenCalledWith(ACCESS_TOKEN, "a", "Closed");
    expect(screen.queryByRole("button", { name: "Pause" })).not.toBeInTheDocument();
  });

  it("shows an error with retry that reloads", async () => {
    vi.mocked(listMyPostings).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(listMyPostings).mockResolvedValueOnce({ items: [makePosting({ title: "Back again" })] });
    render(<EmployerJobsPage />);
    expect(await screen.findByText("Could not load your openings")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByText("Back again")).toBeInTheDocument();
    expect(listMyPostings).toHaveBeenCalledTimes(2);
  });

  it("shows the saved line and strips the marker from the URL", async () => {
    searchParams = new URLSearchParams("saved=created");
    vi.mocked(listMyPostings).mockResolvedValue({ items: [] });
    render(<EmployerJobsPage />);
    expect(await screen.findByText("Opening posted.")).toBeInTheDocument();
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/employer/jobs"));
  });
});
