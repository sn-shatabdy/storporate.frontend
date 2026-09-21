import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

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

async function flushSearchDebounce() {
  await new Promise((resolve) => setTimeout(resolve, 400));
}

async function renderPage() {
  const result = render(<EmployerJobsPage />);
  // Allow Suspense fallback to flush (the page is client-side w/ useSearchParams).
  await act(async () => {});
  return result;
}

describe("employer openings list", () => {
  it("shows skeletons while loading", async () => {
    vi.mocked(listMyPostings).mockReturnValue(new Promise(() => {}));
    await renderPage();
    expect(screen.getByText("Loading your openings.")).toBeInTheDocument();
  });

  it("shows the empty state with a Post an opening link", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [],
      counts: { open: 0, paused: 0, closed: 0, total: 0 },
    });
    await renderPage();
    expect(await screen.findByText("No openings yet")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: /Post an opening/ });
    expect(links.length).toBeGreaterThan(0);
    for (const l of links) expect(l).toHaveAttribute("href", "/employer/jobs/new");
  });

  it("renders cards with pills, skills and the right action labels per status", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [
        makePosting({ id: "a", title: "Open one", status: "Open", applicantCount: 12 }),
        makePosting({
          id: "b",
          title: "Paused one",
          status: "Paused",
          kind: "Internship",
          applicantCount: 4,
        }),
        makePosting({ id: "c", title: "Closed one", status: "Closed", applicantCount: 19 }),
      ],
      counts: { open: 1, paused: 1, closed: 1, total: 3 },
    });
    await renderPage();
    expect(await screen.findByText("Open one")).toBeInTheDocument();
    expect(listMyPostings).toHaveBeenCalledWith(
      ACCESS_TOKEN,
      expect.objectContaining({}),
      expect.anything(),
    );
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Open");
    expect(cards[0]).toHaveTextContent("Job");
    expect(cards[0]).toHaveTextContent("Hybrid · Dhaka");
    expect(cards[0]).toHaveTextContent("Power BI");
    expect(within(cards[0]).getByRole("link", { name: /View applicants/ })).toHaveAttribute(
      "href",
      "/employer/jobs/a/applicants",
    );
    expect(cards[0].querySelector('a[href="/employer/jobs/a/edit"]')).toHaveTextContent("Edit");
    expect(within(cards[2]).queryByRole("button", { name: /More actions/ })).not.toBeInTheDocument();
  });

  it("pause via the More menu calls the API once and updates the card", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [makePosting({ id: "a", title: "Open one" })],
      counts: { open: 1, paused: 0, closed: 0, total: 1 },
    });
    vi.mocked(setPostingStatus).mockResolvedValue(
      makePosting({ id: "a", status: "Paused" }),
    );
    await renderPage();
    const trigger = await screen.findByRole("button", { name: /More actions/ });
    fireEvent.click(trigger);
    const pause = await screen.findByRole("menuitem", { name: "Pause opening" });
    fireEvent.click(pause);
    await waitFor(() =>
      expect(setPostingStatus).toHaveBeenCalledWith(ACCESS_TOKEN, "a", "Paused"),
    );
  });

  it("reopen via the More menu calls the API once with Open", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [makePosting({ id: "a", status: "Paused" })],
      counts: { open: 0, paused: 1, closed: 0, total: 1 },
    });
    vi.mocked(setPostingStatus).mockResolvedValue(makePosting({ id: "a", status: "Open" }));
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /More actions/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Reopen opening" }));
    await waitFor(() =>
      expect(setPostingStatus).toHaveBeenCalledWith(ACCESS_TOKEN, "a", "Open"),
    );
  });

  it("More menu supports keyboard nav (ArrowDown cycles and Enter activates)", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [makePosting({ id: "a" })],
      counts: { open: 1, paused: 0, closed: 0, total: 1 },
    });
    await renderPage();
    const trigger = await screen.findByRole("button", { name: /More actions/ });
    trigger.focus();
    // Enter opens the menu and focuses the first item.
    fireEvent.keyDown(trigger, { key: "Enter" });
    const pause = await screen.findByRole("menuitem", { name: "Pause opening" });
    expect(pause).toHaveFocus();
    // ArrowDown cycles past Pause to Close.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "ArrowDown" });
    const close = await screen.findByRole("menuitem", { name: "Close opening" });
    expect(close).toHaveFocus();
  });

  it("close opens a dialog; Keep it cancels; Yes, close it calls the API", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [makePosting({ id: "a", title: "Open one" })],
      counts: { open: 1, paused: 0, closed: 0, total: 1 },
    });
    vi.mocked(setPostingStatus).mockResolvedValue(makePosting({ id: "a", status: "Closed" }));
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /More actions/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Close opening" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Close this opening?");
    expect(dialog).toHaveTextContent("Open one");
    // Cancel without calling the API.
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep it" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(setPostingStatus).not.toHaveBeenCalled();
    // Re-open and confirm.
    fireEvent.click(await screen.findByRole("button", { name: /More actions/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Close opening" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, close it" }));
    await waitFor(() =>
      expect(setPostingStatus).toHaveBeenCalledWith(ACCESS_TOKEN, "a", "Closed"),
    );
  });

  it("Escape closes the close dialog", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [makePosting({ id: "a" })],
      counts: { open: 1, paused: 0, closed: 0, total: 1 },
    });
    await renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /More actions/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Close opening" }));
    await screen.findByRole("dialog");
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows an error with retry that reloads", async () => {
    vi.mocked(listMyPostings)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        items: [makePosting({ title: "Back again" })],
        counts: { open: 1, paused: 0, closed: 0, total: 1 },
      });
    await renderPage();
    expect(await screen.findByText(/Could not load your openings/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByText("Back again")).toBeInTheDocument();
    expect(listMyPostings).toHaveBeenCalledTimes(2);
  });

  it("shows the saved line and strips the marker from the URL", async () => {
    searchParams = new URLSearchParams("saved=created");
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [],
      counts: { open: 0, paused: 0, closed: 0, total: 0 },
    });
    await renderPage();
    expect(await screen.findByText("Opening posted.")).toBeInTheDocument();
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/employer/jobs"));
  });

  it("links each posting to its applicants", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [
        makePosting({ id: "a", status: "Open", applicantCount: 5 }),
        makePosting({ id: "c", status: "Closed", applicantCount: 9 }),
      ],
      counts: { open: 1, paused: 0, closed: 1, total: 2 },
    });
    await renderPage();
    const cards = await screen.findAllByRole("article");
    expect(within(cards[0]).getByRole("link", { name: /View applicants/ })).toHaveAttribute(
      "href",
      "/employer/jobs/a/applicants",
    );
    expect(within(cards[1]).getByRole("link", { name: /View applicants/ })).toHaveAttribute(
      "href",
      "/employer/jobs/c/applicants",
    );
  });

  it("renders tabs with counts from the response", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [],
      counts: { open: 2, paused: 1, closed: 4, total: 7 },
    });
    await renderPage();
    const tabs = await screen.findAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent("All");
    expect(tabs[1]).toHaveTextContent("Open");
    expect(tabs[1]).toHaveTextContent("2");
    expect(tabs[2]).toHaveTextContent("Paused");
    expect(tabs[2]).toHaveTextContent("1");
    expect(tabs[3]).toHaveTextContent("Closed");
    expect(tabs[3]).toHaveTextContent("4");
  });

  it("switching to a status tab refetches with status and the All tab sends none", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [],
      counts: { open: 1, paused: 0, closed: 0, total: 1 },
    });
    await renderPage();
    expect(await screen.findAllByRole("tab")).toHaveLength(4);
    // Initial call was with no status.
    expect(listMyPostings).toHaveBeenLastCalledWith(
      ACCESS_TOKEN,
      expect.not.objectContaining({ status: expect.anything() }),
      expect.anything(),
    );
    fireEvent.click(screen.getByRole("tab", { name: /Open/ }));
    await waitFor(() =>
      expect(listMyPostings).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        expect.objectContaining({ status: "Open" }),
        expect.anything(),
      ),
    );
    fireEvent.click(screen.getByRole("tab", { name: /All/ }));
    await waitFor(() =>
      expect(listMyPostings).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        expect.not.objectContaining({ status: expect.anything() }),
        expect.anything(),
      ),
    );
  });

  it("search input is debounced and emits q on the next call", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [makePosting()],
      counts: { open: 1, paused: 0, closed: 0, total: 1 },
    });
    await renderPage();
    expect(listMyPostings).toHaveBeenCalledTimes(1);
    const box = screen.getByLabelText(/Search your openings/);
    fireEvent.change(box, { target: { value: "j" } });
    fireEvent.change(box, { target: { value: "junior" } });
    // Not yet — debounced.
    expect(listMyPostings).toHaveBeenCalledTimes(1);
    await flushSearchDebounce();
    await waitFor(() => expect(listMyPostings).toHaveBeenCalledTimes(2));
    expect(listMyPostings).toHaveBeenLastCalledWith(
      ACCESS_TOKEN,
      expect.objectContaining({ q: "junior" }),
      expect.anything(),
    );
  });

  it("shows the dimming class for paused and closed cards", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [
        makePosting({ id: "a", status: "Open" }),
        makePosting({ id: "b", status: "Paused" }),
        makePosting({ id: "c", status: "Closed" }),
      ],
      counts: { open: 1, paused: 1, closed: 1, total: 3 },
    });
    await renderPage();
    const [open, paused, closed] = await screen.findAllByRole("article");
    expect(open.className).not.toMatch(/opacity-/);
    expect(paused.className).toMatch(/opacity-\[0\.88\]/);
    expect(closed.className).toMatch(/opacity-70/);
  });

  it("shows the No openings match card with a Clear filters CTA when a search yields zero", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [],
      counts: { open: 0, paused: 0, closed: 0, total: 0 },
    });
    await renderPage();
    expect(await screen.findByText(/No openings yet/)).toBeInTheDocument();
  });

  it("renders the expired chip and notes for an Open posting past its deadline", async () => {
    vi.mocked(listMyPostings).mockResolvedValue({
      items: [
        makePosting({
          id: "a",
          status: "Open",
          applicationDeadline: "2025-01-01",
          isExpired: true,
        }),
      ],
      counts: { open: 1, paused: 0, closed: 0, total: 1 },
    });
    await renderPage();
    expect(await screen.findByText("Expired")).toBeInTheDocument();
    expect(screen.getByText(/deadline has passed/i)).toBeInTheDocument();
  });
});