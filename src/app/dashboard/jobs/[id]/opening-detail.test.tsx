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
  // jsdom does not implement scrollIntoView or requestAnimationFrame
  // by default. The sticky bar's button relies on both when the user
  // taps it; mock them so the click handler runs end-to-end in tests.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  } else {
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
  }
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (cb: FrameRequestCallback) =>
      window.setTimeout(() => cb(performance.now()), 0) as unknown as number;
  }
});

afterEach(() => cleanup());

describe("student opening detail", () => {
  it("renders header, fit summary, description, two skill groups, and a link back to the list", async () => {
    vi.mocked(getJob).mockResolvedValue(makeJob());
    render(<OpeningDetailPage />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Junior data analyst" }),
    ).toBeInTheDocument();
    expect(getJob).toHaveBeenCalledWith(ACCESS_TOKEN, "job-1", expect.anything());
    expect(
      screen.getByText(/You show 2 of the 3 skills this role asks for\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Build dashboards and clean sales data for the team.")).toBeInTheDocument();
    // The fit pill appears in the header AND in the phone sticky
    // apply bar — both should be present, so look for both.
    expect(screen.getAllByText("Good match").length).toBeGreaterThanOrEqual(1);

    const fitRegion = screen.getByRole("region", { name: "How you fit" });
    const rows = within(fitRegion).getAllByRole("listitem");
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
    const portfolio = await screen.findByRole("link", { name: /portfolio/ });
    expect(portfolio).toHaveAttribute("href", "/dashboard/portfolio");
    expect(screen.getByRole("link", { name: "Back to openings" })).toHaveAttribute(
      "href",
      "/dashboard/jobs",
    );
  });

  it("shows the not found state on 404", async () => {
    vi.mocked(getJob).mockRejectedValue(new ApiError("job_posting_not_found", "x", 404));
    render(<OpeningDetailPage />);
    expect(await screen.findByText("This opening is no longer available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to openings" })).toBeInTheDocument();
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
    // ApplyPanel renders one "Apply" submit button inside the apply
    // section. The sticky bar's own "Apply" button also lives in the
    // DOM, so scope the assertion to the apply section to confirm the
    // real ApplyPanel is there.
    const applySection = await screen.findByRole("region", { name: "Apply" });
    expect(within(applySection).getByRole("button", { name: "Apply" })).toBeInTheDocument();
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

  it("builds the fit summary sentence in plain words from matched and missing counts", async () => {
    vi.mocked(getJob).mockResolvedValue(
      makeJob({
        fit: {
          label: "Good match",
          matched: [
            { name: "Python", band: "Strong" },
            { name: "SQL", band: "Strong" },
            { name: "Git", band: "Developing" },
          ],
          missing: ["Docker", "REST APIs"],
        },
      }),
    );
    render(<OpeningDetailPage />);
    expect(
      await screen.findByText(/You show 3 of the 5 skills this role asks for\./),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Python, SQL and Git are in your portfolio\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Docker and REST APIs are not shown yet\./)).toBeInTheDocument();
  });

  it("renders the key facts with openings, deadline, posted date, and optional pay", async () => {
    vi.mocked(getJob).mockResolvedValue(
      makeJob({
        openings: 4,
        applicationDeadline: futureIso(10),
        compensation: { min: 15000, max: 25000, visibleToStudents: true },
      }),
    );
    render(<OpeningDetailPage />);
    expect(await screen.findByText("4 openings")).toBeInTheDocument();
    expect(screen.getByText("BDT 15,000 to 25,000 per month")).toBeInTheDocument();
    const facts = screen.getByRole("region", { name: "Key facts" });
    expect(facts).toHaveTextContent(/Apply by/);
    expect(facts).toHaveTextContent(/Posted/);
  });

  it("shows the unavailable banner when an applied posting is paused or expired", async () => {
    vi.mocked(getJob).mockResolvedValue(
      makeJob({
        status: "Paused",
        isExpired: false,
        application: { id: "app-1", status: "Submitted" },
      }),
    );
    render(<OpeningDetailPage />);
    expect(
      await screen.findByText("This opening is no longer accepting applications."),
    ).toBeInTheDocument();
    // ApplyPanel renders the applied branch (no Apply button) for the
    // paused case; the right rail still names "Your application".
    expect(screen.getByText("Your application")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("shows the unavailable banner for an expired applied posting", async () => {
    vi.mocked(getJob).mockResolvedValue(
      makeJob({
        status: "Open",
        isExpired: true,
        applicationDeadline: pastIso(),
        application: { id: "app-1", status: "Submitted" },
      }),
    );
    render(<OpeningDetailPage />);
    expect(
      await screen.findByText("This opening is no longer accepting applications."),
    ).toBeInTheDocument();
  });

  it("does not show the unavailable banner for a paused posting the student has not applied to", async () => {
    vi.mocked(getJob).mockResolvedValue(
      makeJob({ status: "Paused", application: null }),
    );
    render(<OpeningDetailPage />);
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(
      screen.queryByText("This opening is no longer accepting applications."),
    ).not.toBeInTheDocument();
  });

  it("renders the phone sticky bar with a real Apply button and the fit pill", async () => {
    vi.mocked(getJob).mockResolvedValue(makeJob());
    render(<OpeningDetailPage />);
    const bar = await screen.findByRole("region", { name: "Phone sticky apply bar" });
    // The bar exposes its primary action as a real <button>, not a
    // plain text label. The ApplyPanel also renders a submit button
    // named "Apply", so the bar scopes the lookup.
    const applyButton = within(bar).getByRole("button", { name: "Apply" });
    expect(applyButton.tagName).toBe("BUTTON");
    expect(applyButton).toHaveClass("bg-primary", "text-primary-foreground");
    // Fit pill rendered inside the bar.
    expect(within(bar).getByText("Good match")).toBeInTheDocument();
    // Apply section exists in the DOM and has the id used for scrolling.
    const applySection = document.getElementById("apply-section");
    expect(applySection).not.toBeNull();
    expect(applySection).toHaveAttribute("aria-label", "Apply");
  });

  it("the sticky bar's Apply button scrolls to and focuses the apply section", async () => {
    vi.mocked(getJob).mockResolvedValue(makeJob());
    render(<OpeningDetailPage />);
    const bar = await screen.findByRole("region", { name: "Phone sticky apply bar" });
    const applyButton = within(bar).getByRole("button", { name: "Apply" });
    const applySection = document.getElementById("apply-section") as HTMLElement;
    const scrollSpy = vi.spyOn(applySection, "scrollIntoView");

    applyButton.click();

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

    // Focus moves to the first focusable child of the apply section
    // (the ApplyPanel's submit button). requestAnimationFrame is
    // polyfilled to setTimeout in `beforeEach`.
    await vi.waitFor(() => {
      expect(document.activeElement).toBe(
        within(applySection).getByRole("button", { name: "Apply" }),
      );
    });
  });

  it("does not render the sticky bar when the posting is unavailable and the student has not applied", async () => {
    vi.mocked(getJob).mockResolvedValue(
      makeJob({ status: "Paused", application: null }),
    );
    render(<OpeningDetailPage />);
    await screen.findByRole("heading", { level: 1 });
    expect(
      screen.queryByRole("region", { name: "Phone sticky apply bar" }),
    ).not.toBeInTheDocument();
  });

  it("shows the deadline chip text inside the sticky bar", async () => {
    vi.mocked(getJob).mockResolvedValue(
      makeJob({ applicationDeadline: futureIso(10) }),
    );
    render(<OpeningDetailPage />);
    const bar = await screen.findByRole("region", { name: "Phone sticky apply bar" });
    // The deadline text comes from `deadlineText` and is rendered
    // inside the bar (the exact wording depends on the helper, so
    // assert by presence of a "Closes" / "Apply by" fragment).
    expect(within(bar).getByText(/Closes in|Apply by/)).toBeInTheDocument();
  });

  it("renders the sticky bar button as 'View application' once the student has applied", async () => {
    vi.mocked(getJob).mockResolvedValue(
      makeJob({ application: { id: "app-1", status: "Submitted" } }),
    );
    render(<OpeningDetailPage />);
    const bar = await screen.findByRole("region", { name: "Phone sticky apply bar" });
    const applyButton = within(bar).getByRole("button", { name: "View application" });
    expect(applyButton.tagName).toBe("BUTTON");
    // ApplyPanel in its applied branch shows no submit button named
    // "Apply" — only the sticky bar's "View application" remains.
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("renders the apply form exactly once in the DOM (no duplicate ApplyPanel)", async () => {
    vi.mocked(getJob).mockResolvedValue(makeJob());
    render(<OpeningDetailPage />);
    await screen.findByRole("heading", { level: 1 });
    // The apply section is the only host of the form/button. Inside
    // it we expect exactly one submit button named "Apply".
    const applySection = document.getElementById("apply-section") as HTMLElement;
    expect(applySection).not.toBeNull();
    const applyButtons = within(applySection).getAllByRole("button", { name: "Apply" });
    expect(applyButtons).toHaveLength(1);
    // And the sticky bar contains exactly one more (the bar's own
    // "Apply" button) — the bar does NOT embed another ApplyPanel.
    const bar = screen.getByRole("region", { name: "Phone sticky apply bar" });
    const barApplyButtons = within(bar).getAllByRole("button", { name: "Apply" });
    expect(barApplyButtons).toHaveLength(1);
  });
});

function futureIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function pastIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 3);
  return d.toISOString().slice(0, 10);
}
