import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "job-1" }) }));
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
  return { ...actual, getMyPosting: vi.fn() };
});
vi.mock("@/lib/api/jobApplications", () => ({
  listApplicants: vi.fn(),
  getApplicant: vi.fn(),
  setApplicantStatus: vi.fn(),
}));

import { useSession } from "next-auth/react";
import { ApiError } from "@/lib/api/errors";
import { getMyPosting } from "@/lib/api/jobPostings";
import {
  getApplicant,
  listApplicants,
  setApplicantStatus,
} from "@/lib/api/jobApplications";
import { ACCESS_TOKEN, makeApplicant, makePosting } from "@/components/jobs/test-fixtures";

import ApplicantsPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Organization" },
    status: "authenticated",
  } as never);
  vi.mocked(getMyPosting).mockResolvedValue(makePosting());
  vi.mocked(listApplicants).mockResolvedValue({
    items: [
      makeApplicant({ id: "a1", displayName: "Nadia Rahman", status: "Submitted" }),
      makeApplicant({ id: "a2", displayName: "Imran Hossain", status: "Shortlisted" }),
      makeApplicant({
        id: "a3",
        displayName: "Tania Akter",
        status: "NotSelected",
        headline: null,
        university: null,
        fieldOfStudy: null,
        studyYear: null,
        items: [],
        fit: { label: "Not yet", matched: [], missing: ["Power BI", "Excel", "SQL"] },
      }),
    ],
  });
});

afterEach(() => cleanup());

async function cards() {
  return screen.findAllByRole("article");
}

describe("employer applicants", () => {
  it("shows skeletons while loading", () => {
    vi.mocked(getMyPosting).mockReturnValue(new Promise(() => {}));
    render(<ApplicantsPage />);
    expect(screen.getByText("Loading applicants.")).toBeInTheDocument();
  });

  it("renders the posting title, a back link and a card per applicant", async () => {
    render(<ApplicantsPage />);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Junior data analyst" }),
    ).toBeInTheDocument();
    expect(getMyPosting).toHaveBeenCalledWith(ACCESS_TOKEN, "job-1", expect.anything());
    expect(listApplicants).toHaveBeenCalledWith(ACCESS_TOKEN, "job-1", expect.anything());
    expect(screen.getByRole("link", { name: "Your openings" })).toHaveAttribute(
      "href",
      "/employer/jobs",
    );
    const list = await cards();
    expect(list).toHaveLength(3);
    const first = list[0];
    expect(within(first).getByText("Nadia Rahman")).toBeInTheDocument();
    expect(within(first).getByText("NR")).toBeInTheDocument();
    expect(within(first).getByText("Data student who builds dashboards")).toBeInTheDocument();
    expect(
      within(first).getByText("BUET · Computer Science · Year 3 · Applied Sep 20, 2026"),
    ).toBeInTheDocument();
    expect(within(first).getByText("Submitted")).toHaveClass("bg-secondary", "text-muted-foreground");
    expect(within(first).getByText("Good match")).toBeInTheDocument();
    expect(first).toHaveTextContent("Matches: Power BI, Excel");
    expect(first).toHaveTextContent("Not yet shown: SQL");
    expect(within(first).getByText("Sales dashboard")).toBeInTheDocument();
    expect(within(first).getByText("Power BI · Strong")).toHaveClass(
      "bg-success-soft",
      "text-success",
    );
    expect(within(first).getByText("Excel · Developing")).toHaveClass(
      "bg-warning-soft",
      "text-warning",
    );
    expect(within(list[2]).getByText("Not yet")).toBeInTheDocument();
    expect(within(list[2]).queryByText(/Matches:/)).not.toBeInTheDocument();
  });

  it("filters by status", async () => {
    render(<ApplicantsPage />);
    await cards();
    const group = screen.getByRole("group", { name: "Filter by status" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "All",
      "Submitted",
      "Viewed",
      "Shortlisted",
      "Not selected",
    ]);
    expect(within(group).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(group).getByRole("button", { name: "Shortlisted" }));
    let list = await cards();
    expect(list).toHaveLength(1);
    expect(list[0]).toHaveTextContent("Imran Hossain");

    fireEvent.click(within(group).getByRole("button", { name: "Not selected" }));
    list = await cards();
    expect(list).toHaveLength(1);
    expect(list[0]).toHaveTextContent("Tania Akter");

    fireEvent.click(within(group).getByRole("button", { name: "Viewed" }));
    expect(await screen.findByText("No applications here")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();

    fireEvent.click(within(group).getByRole("button", { name: "All" }));
    expect(await cards()).toHaveLength(3);
  });

  it("opens an applicant, marks it Viewed and updates the pill", async () => {
    vi.mocked(getApplicant).mockResolvedValue(
      makeApplicant({ id: "a1", displayName: "Nadia Rahman", status: "Viewed" }),
    );
    render(<ApplicantsPage />);
    const first = (await cards())[0];
    const toggle = within(first).getByRole("button", { name: "Open" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);

    await waitFor(() => expect(within(first).getByText("Viewed")).toBeInTheDocument());
    expect(getApplicant).toHaveBeenCalledWith(ACCESS_TOKEN, "job-1", "a1");
    expect(within(first).getByText("Viewed")).toHaveClass("bg-info-soft", "text-info");
    expect(within(first).queryByText("Submitted")).not.toBeInTheDocument();

    const panel = within(first).getByRole("region", { name: "Details for Nadia Rahman" });
    const rows = within(within(panel).getByRole("region", { name: "How they fit" })).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[2]).toHaveTextContent("SQL");
    expect(rows[2]).toHaveTextContent("Not shown yet");
    expect(within(panel).getByRole("button", { name: "Shortlist" })).toBeEnabled();
    expect(within(panel).getByRole("button", { name: "Not selected" })).toBeEnabled();

    // Hide and open again does not ask the server twice.
    fireEvent.click(within(first).getByRole("button", { name: "Hide" }));
    expect(within(first).queryByRole("region", { name: /Details for/ })).not.toBeInTheDocument();
    fireEvent.click(within(first).getByRole("button", { name: "Open" }));
    expect(getApplicant).toHaveBeenCalledTimes(1);
  });

  it("keeps an opened card visible under a filter after it turns Viewed", async () => {
    vi.mocked(getApplicant).mockResolvedValue(makeApplicant({ id: "a1", status: "Viewed" }));
    render(<ApplicantsPage />);
    await cards();
    fireEvent.click(screen.getByRole("button", { name: "Submitted" }));
    const list = await cards();
    expect(list).toHaveLength(1);
    fireEvent.click(within(list[0]).getByRole("button", { name: "Open" }));
    await waitFor(() => expect(within(list[0]).getByText("Viewed")).toBeInTheDocument());
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("shows an inline error when the detail cannot be loaded", async () => {
    vi.mocked(getApplicant).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(getApplicant).mockResolvedValueOnce(makeApplicant({ id: "a1", status: "Viewed" }));
    render(<ApplicantsPage />);
    const first = (await cards())[0];
    fireEvent.click(within(first).getByRole("button", { name: "Open" }));
    expect(await within(first).findByRole("alert")).toHaveTextContent("Could not load the details.");
    fireEvent.click(within(first).getByRole("button", { name: "Hide" }));
    fireEvent.click(within(first).getByRole("button", { name: "Open" }));
    await waitFor(() => expect(within(first).getByText("Viewed")).toBeInTheDocument());
    expect(within(first).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shortlists an applicant and shows the pressed state", async () => {
    vi.mocked(getApplicant).mockResolvedValue(makeApplicant({ id: "a1", status: "Viewed" }));
    vi.mocked(setApplicantStatus).mockResolvedValue(
      makeApplicant({ id: "a1", status: "Shortlisted" }),
    );
    render(<ApplicantsPage />);
    const first = (await cards())[0];
    fireEvent.click(within(first).getByRole("button", { name: "Open" }));
    const shortlist = await within(first).findByRole("button", { name: "Shortlist" });
    await waitFor(() => expect(shortlist).toBeEnabled());
    fireEvent.click(shortlist);

    await waitFor(() =>
      expect(within(first).getByRole("button", { name: "Shortlist" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(setApplicantStatus).toHaveBeenCalledWith(ACCESS_TOKEN, "job-1", "a1", "Shortlisted");
    expect(within(first).getByRole("button", { name: "Shortlist" })).toBeDisabled();
    expect(within(first).getByRole("button", { name: "Not selected" })).toBeEnabled();
    expect(within(first).getAllByText("Shortlisted").length).toBeGreaterThan(0);
  });

  it("marks an applicant Not selected and shows a busy state", async () => {
    vi.mocked(getApplicant).mockResolvedValue(makeApplicant({ id: "a1", status: "Viewed" }));
    let resolve!: (v: ReturnType<typeof makeApplicant>) => void;
    vi.mocked(setApplicantStatus).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<ApplicantsPage />);
    const first = (await cards())[0];
    fireEvent.click(within(first).getByRole("button", { name: "Open" }));
    const decline = await within(first).findByRole("button", { name: "Not selected" });
    await waitFor(() => expect(decline).toBeEnabled());
    fireEvent.click(decline);

    expect(await within(first).findByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(within(first).getByRole("button", { name: "Shortlist" })).toBeDisabled();
    resolve(makeApplicant({ id: "a1", status: "NotSelected" }));
    await waitFor(() =>
      expect(within(first).getByRole("button", { name: "Not selected" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
    expect(setApplicantStatus).toHaveBeenCalledWith(ACCESS_TOKEN, "job-1", "a1", "NotSelected");
  });

  it("shows an inline error when saving a decision fails", async () => {
    vi.mocked(getApplicant).mockResolvedValue(makeApplicant({ id: "a1", status: "Viewed" }));
    vi.mocked(setApplicantStatus).mockRejectedValue(new Error("boom"));
    render(<ApplicantsPage />);
    const first = (await cards())[0];
    fireEvent.click(within(first).getByRole("button", { name: "Open" }));
    const shortlist = await within(first).findByRole("button", { name: "Shortlist" });
    await waitFor(() => expect(shortlist).toBeEnabled());
    fireEvent.click(shortlist);
    expect(await within(first).findByRole("alert")).toHaveTextContent(
      "Could not save your decision. Try again.",
    );
    expect(within(first).getByRole("button", { name: "Shortlist" })).toBeEnabled();
  });

  it("shows the empty state", async () => {
    vi.mocked(listApplicants).mockResolvedValue({ items: [] });
    render(<ApplicantsPage />);
    expect(await screen.findByText("No applications yet.")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Filter by status" })).not.toBeInTheDocument();
  });

  it("shows an error and retries", async () => {
    vi.mocked(listApplicants).mockRejectedValueOnce(new Error("boom"));
    render(<ApplicantsPage />);
    expect(await screen.findByText("Could not load applicants")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await cards()).toHaveLength(3);
  });

  it("shows a not found state when the opening is missing", async () => {
    vi.mocked(getMyPosting).mockRejectedValue(new ApiError("job_posting_not_found", "x", 404));
    render(<ApplicantsPage />);
    expect(await screen.findByText("This opening was not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Your openings" })).toBeInTheDocument();
  });
});
