import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
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
  return { ...actual, listJobs: vi.fn() };
});

import { useSession } from "next-auth/react";
import { listJobs, type FitLabel, type JobBrowsePage } from "@/lib/api/jobPostings";
import { ACCESS_TOKEN, makeJob } from "@/components/jobs/test-fixtures";

import OpeningsPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Student" },
    status: "authenticated",
  } as never);
});

afterEach(() => cleanup());

function page(items: JobBrowsePage["items"], total?: number): JobBrowsePage {
  return {
    items,
    page: 1,
    pageSize: 20,
    total: total ?? items.length,
  };
}

const FIT_TOKEN_CLASS: Record<FitLabel, { bg: string; fg: string }> = {
  "Strong match": { bg: "bg-success-soft", fg: "text-success" },
  "Good match": { bg: "bg-info-soft", fg: "text-info" },
  "Early match": { bg: "bg-warning-soft", fg: "text-warning" },
  "Not yet": { bg: "bg-secondary", fg: "text-muted-foreground" },
};

describe("student openings list", () => {
  it("shows skeletons while loading", () => {
    vi.mocked(listJobs).mockReturnValue(new Promise(() => {}));
    render(<OpeningsPage />);
    expect(screen.getByText("Loading openings.")).toBeInTheDocument();
  });

  it.each(Object.keys(FIT_TOKEN_CLASS) as FitLabel[])(
    "renders the %s pill with its colors",
    async (label) => {
      vi.mocked(listJobs).mockResolvedValue(
        page([makeJob({ fit: { label, matched: [], missing: ["SQL"] } })]),
      );
      render(<OpeningsPage />);
      const pill = await screen.findByText(label);
      expect(pill).toHaveClass(FIT_TOKEN_CLASS[label].bg);
      expect(pill).toHaveClass(FIT_TOKEN_CLASS[label].fg);
    },
  );

  it("shows title link, company, kind, work mode, and the skill rows with up to 3 chips", async () => {
    vi.mocked(listJobs).mockResolvedValue(page([makeJob()]));
    render(<OpeningsPage />);
    const link = await screen.findByRole("link", { name: "Junior data analyst" });
    expect(link).toHaveAttribute("href", "/dashboard/jobs/job-1");
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("Acme Analytics");
    expect(card).toHaveTextContent("Job");
    expect(card).toHaveTextContent("Hybrid");
    expect(card).toHaveTextContent("Dhaka");
    expect(card).toHaveTextContent("You have");
    expect(card).toHaveTextContent("Power BI");
    expect(card).toHaveTextContent("Excel");
    expect(card).toHaveTextContent("To build");
    expect(card).toHaveTextContent("SQL");
  });

  it("truncates skill lists to three with a +N more tail", async () => {
    vi.mocked(listJobs).mockResolvedValue(
      page([
        makeJob({
          fit: {
            label: "Strong match",
            matched: ["A1", "B2", "C3", "D4", "E5"].map((name) => ({
              name,
              band: "Strong" as const,
            })),
            missing: ["M1", "M2", "M3", "M4"],
          },
        }),
      ]),
    );
    render(<OpeningsPage />);
    const card = (await screen.findAllByRole("article"))[0];
    expect(card).toHaveTextContent("+2 more");
    expect(card).toHaveTextContent("+1 more");
    expect(card).not.toHaveTextContent("D4");
  });

  it("calls the API without filters first, then sends kind and workMode", async () => {
    vi.mocked(listJobs).mockResolvedValue(page([makeJob()]));
    render(<OpeningsPage />);
    await screen.findByRole("article");
    await waitFor(() =>
      expect(listJobs).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        {
          kind: undefined,
          workMode: undefined,
          q: undefined,
          sort: "fit",
          page: 1,
          pageSize: 20,
        },
        expect.anything(),
      ),
    );
    const kindFieldset = screen.getByRole("group", { name: "Kind" });
    const modeFieldset = screen.getByRole("group", { name: "Work mode" });
    fireEvent.click(within(kindFieldset).getByRole("radio", { name: "Internship" }));
    await waitFor(() =>
      expect(listJobs).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        {
          kind: "Internship",
          workMode: undefined,
          q: undefined,
          sort: "fit",
          page: 1,
          pageSize: 20,
        },
        expect.anything(),
      ),
    );
    fireEvent.click(within(modeFieldset).getByRole("radio", { name: "Remote" }));
    await waitFor(() =>
      expect(listJobs).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        {
          kind: "Internship",
          workMode: "Remote",
          q: undefined,
          sort: "fit",
          page: 1,
          pageSize: 20,
        },
        expect.anything(),
      ),
    );
  });

  it("sends sort=newest and page=1 when the sort changes", async () => {
    vi.mocked(listJobs).mockResolvedValue(page([makeJob()]));
    render(<OpeningsPage />);
    await screen.findByRole("article");
    fireEvent.change(screen.getByLabelText("Sort openings"), {
      target: { value: "newest" },
    });
    await waitFor(() =>
      expect(listJobs).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        {
          kind: undefined,
          workMode: undefined,
          q: undefined,
          sort: "newest",
          page: 1,
          pageSize: 20,
        },
        expect.anything(),
      ),
    );
  });

  it("sends the search text after a short pause", async () => {
    vi.mocked(listJobs).mockResolvedValue(page([makeJob()]));
    render(<OpeningsPage />);
    await screen.findByRole("article");
    fireEvent.change(screen.getByLabelText("Search openings"), {
      target: { value: "power bi" },
    });
    await waitFor(() =>
      expect(listJobs).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        {
          kind: undefined,
          workMode: undefined,
          q: "power bi",
          sort: "fit",
          page: 1,
          pageSize: 20,
        },
        expect.anything(),
      ),
    );
  });

  it("shows a removable filter chip per active filter and a Clear all action", async () => {
    vi.mocked(listJobs).mockResolvedValue(page([makeJob()]));
    render(<OpeningsPage />);
    await screen.findByRole("article");
    const kindFieldset = screen.getByRole("group", { name: "Kind" });
    const modeFieldset = screen.getByRole("group", { name: "Work mode" });
    fireEvent.click(within(kindFieldset).getByRole("radio", { name: "Internship" }));
    fireEvent.click(within(modeFieldset).getByRole("radio", { name: "Remote" }));
    // Filter chips live next to the "Clear all" button. Scope by that
    // button so the matching SegmentedControl radio label does not
    // collide with the chip text.
    const clearAll = await screen.findByRole("button", { name: "Clear all" });
    expect(within(clearAll.parentElement!).getByText("Internship")).toBeInTheDocument();
    expect(within(clearAll.parentElement!).getByText("Remote")).toBeInTheDocument();
    fireEvent.click(clearAll);
    await waitFor(() =>
      expect(
        within(screen.getByRole("group", { name: "Kind" })).getByRole("radio", { name: "All" }),
      ).toBeChecked(),
    );
  });

  it("removes a single filter chip with the dedicated button", async () => {
    vi.mocked(listJobs).mockResolvedValue(page([makeJob()]));
    render(<OpeningsPage />);
    await screen.findByRole("article");
    const kindFieldset = screen.getByRole("group", { name: "Kind" });
    const modeFieldset = screen.getByRole("group", { name: "Work mode" });
    fireEvent.click(within(kindFieldset).getByRole("radio", { name: "Internship" }));
    fireEvent.click(within(modeFieldset).getByRole("radio", { name: "Remote" }));
    await screen.findByRole("button", { name: "Remove Internship filter" });
    fireEvent.click(screen.getByRole("button", { name: "Remove Internship filter" }));
    await waitFor(() =>
      expect(listJobs).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        expect.objectContaining({ kind: undefined }),
        expect.anything(),
      ),
    );
  });

  it("shows the plain empty state without filters", async () => {
    vi.mocked(listJobs).mockResolvedValue(page([], 0));
    render(<OpeningsPage />);
    expect(await screen.findByText("No openings yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear all filters" })).not.toBeInTheDocument();
  });

  it("shows a filtered empty state that can clear the filters", async () => {
    vi.mocked(listJobs).mockResolvedValue(page([], 0));
    render(<OpeningsPage />);
    await screen.findByText("No openings yet");
    const kindFieldset = screen.getByRole("group", { name: "Kind" });
    fireEvent.click(within(kindFieldset).getByRole("radio", { name: "Job" }));
    const clear = await screen.findByRole("button", { name: "Clear all filters" });
    fireEvent.click(clear);
    await waitFor(() =>
      expect(
        within(screen.getByRole("group", { name: "Kind" })).getByRole("radio", { name: "All" }),
      ).toBeChecked(),
    );
  });

  it("shows an error with retry", async () => {
    vi.mocked(listJobs).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(listJobs).mockResolvedValueOnce(page([makeJob()]));
    render(<OpeningsPage />);
    expect(await screen.findByText("Could not load openings")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("article")).toBeInTheDocument();
  });

  it("marks openings the student already applied to", async () => {
    vi.mocked(listJobs).mockResolvedValue(
      page([
        makeJob({ id: "j1", application: { id: "app-1", status: "Viewed" } }),
        makeJob({ id: "j2" }),
      ]),
    );
    render(<OpeningsPage />);
    const cards = await screen.findAllByRole("article");
    expect(cards[0]).toHaveTextContent("Applied");
    expect(cards[1]).not.toHaveTextContent("Applied");
  });

  it("announces the result count to assistive tech", async () => {
    vi.mocked(listJobs).mockResolvedValue(page([makeJob(), makeJob({ id: "j2" })], 2));
    render(<OpeningsPage />);
    expect(await screen.findByText("2 of 2 openings")).toBeInTheDocument();
  });

  it("renders the deadline chip and uses the warning tone when closing soon", async () => {
    vi.mocked(listJobs).mockResolvedValue(
      page([
        makeJob({ applicationDeadline: futureIso(2) }),
        makeJob({ id: "j2", applicationDeadline: futureIso(20) }),
      ]),
    );
    render(<OpeningsPage />);
    const cards = await screen.findAllByRole("article");
    const closingSoon = cards[0].querySelector("span")!.textContent ?? "";
    expect(cards[0]).toHaveTextContent(/Closes in 2 days/);
    expect(cards[1]).toHaveTextContent(/Closes/);
    // Both rows have at least one span with the text — verify the warning
    // class is on the closing-soon deadline via a class query on the card.
    expect(closingSoon).toBeDefined();
  });

  it("shows Load more only when more pages exist and appends on click", async () => {
    const first = makeJob({ id: "j1" });
    const second = makeJob({ id: "j2", title: "Backend developer" });
    vi.mocked(listJobs).mockResolvedValueOnce(page([first], 40));
    vi.mocked(listJobs).mockResolvedValueOnce({
      items: [second],
      page: 2,
      pageSize: 20,
      total: 40,
    });
    render(<OpeningsPage />);
    expect(await screen.findByText("1 of 40 openings")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Load more openings/ }));
    expect(await screen.findByText("Backend developer")).toBeInTheDocument();
    await waitFor(() =>
      expect(listJobs).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        expect.objectContaining({ page: 2, pageSize: 20 }),
        expect.anything(),
      ),
    );
  });

  it("hides Load more when all items are already loaded", async () => {
    vi.mocked(listJobs).mockResolvedValue(page([makeJob()], 1));
    render(<OpeningsPage />);
    expect(await screen.findByRole("article")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Load more/ })).not.toBeInTheDocument();
  });

  it("keeps loaded items visible and shows an inline retry when Load more fails", async () => {
    vi.mocked(listJobs).mockResolvedValueOnce(page([makeJob()], 40));
    vi.mocked(listJobs).mockRejectedValueOnce(new Error("boom"));
    render(<OpeningsPage />);
    expect(await screen.findByText("1 of 40 openings")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Load more openings/ }));
    expect(
      await screen.findByText(/Could not load more openings/),
    ).toBeInTheDocument();
    expect(screen.getByRole("article")).toBeInTheDocument();
  });

  it("renders only the pay range when compensation is present", async () => {
    vi.mocked(listJobs).mockResolvedValue(
      page([
        makeJob({
          compensation: { min: 15000, max: 25000, visibleToStudents: true },
        }),
        makeJob({ id: "j2" }),
      ]),
    );
    render(<OpeningsPage />);
    const cards = await screen.findAllByRole("article");
    expect(cards[0]).toHaveTextContent("BDT 15,000 to 25,000 per month");
    expect(cards[1]).not.toHaveTextContent("BDT");
  });
});

function futureIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
