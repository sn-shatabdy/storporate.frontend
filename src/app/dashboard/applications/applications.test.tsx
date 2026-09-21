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
vi.mock("@/lib/api/jobApplications", () => ({ listMyApplications: vi.fn() }));

import { useSession } from "next-auth/react";
import { listMyApplications } from "@/lib/api/jobApplications";
import type { ApplicationStatus } from "@/lib/api/jobPostings";
import { ACCESS_TOKEN, makeApplication } from "@/components/jobs/test-fixtures";

import MyApplicationsPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Student" },
    status: "authenticated",
  } as never);
});

afterEach(() => cleanup());

const STATUS_TOKEN_CLASS: Record<ApplicationStatus, { label: string; bg: string; fg: string }> = {
  Submitted: { label: "Submitted", bg: "bg-secondary", fg: "text-muted-foreground" },
  Viewed: { label: "Viewed", bg: "bg-info-soft", fg: "text-info" },
  Shortlisted: { label: "Shortlisted", bg: "bg-success-soft", fg: "text-success" },
  NotSelected: { label: "Not selected", bg: "bg-warning-soft", fg: "text-warning" },
};

describe("my applications", () => {
  it("shows skeletons while loading", () => {
    vi.mocked(listMyApplications).mockReturnValue(new Promise(() => {}));
    render(<MyApplicationsPage />);
    expect(screen.getByText("Loading your applications.")).toBeInTheDocument();
  });

  it("renders a card per application with title, company, kind, date and fit", async () => {
    vi.mocked(listMyApplications).mockResolvedValue({
      items: [
        makeApplication({ id: "a1", jobPostingId: "j1" }),
        makeApplication({
          id: "a2",
          jobPostingId: "j2",
          jobTitle: "Design intern",
          companyName: "Studio Nine",
          kind: "Internship",
          fitLabel: "Strong match",
        }),
      ],
    });
    render(<MyApplicationsPage />);
    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByRole("link", { name: "Junior data analyst" })).toHaveAttribute(
      "href",
      "/dashboard/jobs/j1",
    );
    expect(within(cards[0]).getByText("Acme Analytics")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Job")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Applied Sep 20, 2026")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Good match")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Internship")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Strong match")).toBeInTheDocument();
    expect(screen.getByText("2 applications")).toBeInTheDocument();
  });

  it.each(Object.keys(STATUS_TOKEN_CLASS) as ApplicationStatus[])(
    "colors the %s status pill",
    async (status) => {
      vi.mocked(listMyApplications).mockResolvedValue({
        items: [makeApplication({ status })],
      });
      render(<MyApplicationsPage />);
      const card = await screen.findByRole("article");
      const c = STATUS_TOKEN_CLASS[status];
      expect(within(card).getByText(c.label)).toHaveClass(c.bg);
      expect(within(card).getByText(c.label)).toHaveClass(c.fg);
    },
  );

  it("shows the empty state with a link to Openings", async () => {
    vi.mocked(listMyApplications).mockResolvedValue({ items: [] });
    render(<MyApplicationsPage />);
    expect(await screen.findByText("You have not applied yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Openings" })).toHaveAttribute(
      "href",
      "/dashboard/jobs",
    );
  });

  it("shows an error and retries", async () => {
    vi.mocked(listMyApplications).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(listMyApplications).mockResolvedValueOnce({ items: [makeApplication()] });
    render(<MyApplicationsPage />);
    expect(await screen.findByText("Could not load your applications")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await waitFor(() => expect(screen.getByRole("article")).toBeInTheDocument());
    expect(listMyApplications).toHaveBeenCalledTimes(2);
  });
});
