import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "job-1" }),
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
  return { ...actual, getJob: vi.fn() };
});

import { useSession } from "next-auth/react";
import { ApiError } from "@/lib/api/errors";
import { getJob } from "@/lib/api/jobPostings";
import { ACCESS_TOKEN, makeJob } from "@/components/jobs/test-fixtures";

import OpeningDetailPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Student" },
    status: "authenticated",
  } as never);
});

afterEach(() => cleanup());

describe("student opening detail", () => {
  it("renders header, description and a row per required skill", async () => {
    vi.mocked(getJob).mockResolvedValue(makeJob());
    render(<OpeningDetailPage />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Junior data analyst" }),
    ).toBeInTheDocument();
    expect(getJob).toHaveBeenCalledWith(ACCESS_TOKEN, "job-1", expect.anything());
    expect(screen.getByText("Build dashboards and clean sales data for the team.")).toBeInTheDocument();
    expect(screen.getByText("Good match")).toBeInTheDocument();

    const rows = within(screen.getByRole("region", { name: "How you fit" })).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    const strong = within(rows[0]).getByText("Strong");
    expect(strong).toHaveClass("bg-success-soft", "text-success");
    const developing = within(rows[1]).getByText("Developing");
    expect(developing).toHaveClass("bg-warning-soft", "text-warning");
    expect(rows[2]).toHaveTextContent("SQL");
    expect(rows[2]).toHaveTextContent("Not shown yet");
  });

  it("links the helper line to the portfolio and back to the list", async () => {
    vi.mocked(getJob).mockResolvedValue(makeJob());
    render(<OpeningDetailPage />);
    const portfolio = await screen.findByRole("link", { name: "portfolio" });
    expect(portfolio).toHaveAttribute("href", "/dashboard/portfolio");
    expect(screen.getByText(/to show more skills\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Openings" })).toHaveAttribute("href", "/dashboard/jobs");
  });

  it("shows the not found state on 404", async () => {
    vi.mocked(getJob).mockRejectedValue(new ApiError("job_posting_not_found", "x", 404));
    render(<OpeningDetailPage />);
    expect(await screen.findByText("This opening is no longer available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Openings" })).toBeInTheDocument();
  });

  it("shows an error with retry for other failures", async () => {
    vi.mocked(getJob).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(getJob).mockResolvedValueOnce(makeJob());
    render(<OpeningDetailPage />);
    expect(await screen.findByText("Could not load this opening")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("shows an Apply button near the header when not applied", async () => {
    vi.mocked(getJob).mockResolvedValue(makeJob());
    render(<OpeningDetailPage />);
    expect(await screen.findByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.queryByText("You applied")).not.toBeInTheDocument();
  });

  it("shows the applied state with the current status when already applied", async () => {
    vi.mocked(getJob).mockResolvedValue(
      makeJob({ application: { id: "app-1", status: "Viewed" } }),
    );
    render(<OpeningDetailPage />);
    expect(await screen.findByText("You applied")).toBeInTheDocument();
    expect(screen.getByText("Viewed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View your applications" })).toHaveAttribute(
      "href",
      "/dashboard/applications",
    );
  });
});
