import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

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
import { listJobs, type FitLabel } from "@/lib/api/jobPostings";
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

const FIT_COLORS: Record<FitLabel, { bg: string; fg: string }> = {
  "Strong match": { bg: "#e6f4ea", fg: "#1e7b34" },
  "Good match": { bg: "#e7f0ed", fg: "#345a73" },
  "Early match": { bg: "#fbeee7", fg: "#a4460f" },
  "Not yet": { bg: "#f3efdd", fg: "#6e6488" },
};

describe("student openings list", () => {
  it("shows skeletons while loading", () => {
    vi.mocked(listJobs).mockReturnValue(new Promise(() => {}));
    render(<OpeningsPage />);
    expect(screen.getByText("Loading openings.")).toBeInTheDocument();
  });

  it.each(Object.keys(FIT_COLORS) as FitLabel[])("renders the %s pill with its colors", async (label) => {
    vi.mocked(listJobs).mockResolvedValue({
      items: [makeJob({ fit: { label, matched: [], missing: ["SQL"] } })],
    });
    render(<OpeningsPage />);
    const pill = await screen.findByText(label);
    expect(pill).toHaveStyle({
      backgroundColor: FIT_COLORS[label].bg,
      color: FIT_COLORS[label].fg,
    });
  });

  it("shows title link, company, kind, mode, and You have and To build lines", async () => {
    vi.mocked(listJobs).mockResolvedValue({ items: [makeJob()] });
    render(<OpeningsPage />);
    const link = await screen.findByRole("link", { name: "Junior data analyst" });
    expect(link).toHaveAttribute("href", "/dashboard/jobs/job-1");
    const card = screen.getByRole("article");
    expect(card).toHaveTextContent("Acme Analytics");
    expect(card).toHaveTextContent("Job");
    expect(card).toHaveTextContent("Hybrid · Dhaka");
    expect(card).toHaveTextContent("You have: Power BI, Excel");
    expect(card).toHaveTextContent("To build: SQL");
  });

  it("truncates long lists to three with a +N more tail", async () => {
    vi.mocked(listJobs).mockResolvedValue({
      items: [
        makeJob({
          fit: {
            label: "Strong match",
            matched: ["A1", "B2", "C3", "D4", "E5"].map((name) => ({ name, band: "Strong" as const })),
            missing: ["M1", "M2", "M3", "M4"],
          },
        }),
      ],
    });
    render(<OpeningsPage />);
    const card = (await screen.findAllByRole("article"))[0];
    expect(card).toHaveTextContent("You have: A1, B2, C3 +2 more");
    expect(card).toHaveTextContent("To build: M1, M2, M3 +1 more");
    expect(card).not.toHaveTextContent("D4");
  });

  it("calls the API without filters first, then with kind and work mode", async () => {
    vi.mocked(listJobs).mockResolvedValue({ items: [makeJob()] });
    render(<OpeningsPage />);
    await screen.findByRole("article");
    expect(listJobs).toHaveBeenLastCalledWith(
      ACCESS_TOKEN,
      { kind: undefined, workMode: undefined, q: undefined },
      expect.anything(),
    );
    fireEvent.click(screen.getByRole("radio", { name: "Internship" }));
    await waitFor(() =>
      expect(listJobs).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        { kind: "Internship", workMode: undefined, q: undefined },
        expect.anything(),
      ),
    );
    fireEvent.change(screen.getByLabelText("Work mode"), { target: { value: "Remote" } });
    await waitFor(() =>
      expect(listJobs).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        { kind: "Internship", workMode: "Remote", q: undefined },
        expect.anything(),
      ),
    );
  });

  it("sends the search text after a short pause", async () => {
    vi.mocked(listJobs).mockResolvedValue({ items: [makeJob()] });
    render(<OpeningsPage />);
    await screen.findByRole("article");
    fireEvent.change(screen.getByLabelText("Search openings"), { target: { value: "power bi" } });
    await waitFor(() =>
      expect(listJobs).toHaveBeenLastCalledWith(
        ACCESS_TOKEN,
        { kind: undefined, workMode: undefined, q: "power bi" },
        expect.anything(),
      ),
    );
  });

  it("shows the plain empty state without filters", async () => {
    vi.mocked(listJobs).mockResolvedValue({ items: [] });
    render(<OpeningsPage />);
    expect(await screen.findByText("No openings yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("shows a filtered empty state that can clear the filters", async () => {
    vi.mocked(listJobs).mockResolvedValue({ items: [] });
    render(<OpeningsPage />);
    await screen.findByText("No openings yet");
    fireEvent.click(screen.getByRole("radio", { name: "Job" }));
    fireEvent.click(await screen.findByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(screen.getByRole("radio", { name: "All" })).toBeChecked());
  });

  it("shows an error with retry", async () => {
    vi.mocked(listJobs).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(listJobs).mockResolvedValueOnce({ items: [makeJob()] });
    render(<OpeningsPage />);
    expect(await screen.findByText("Could not load openings")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("article")).toBeInTheDocument();
  });
});
