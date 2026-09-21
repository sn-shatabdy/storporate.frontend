import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

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
  return { ...actual, getMyPosting: vi.fn(), getJob: vi.fn() };
});
vi.mock("@/lib/api/jobApplications", () => ({
  applyToJob: vi.fn(),
  listMyApplications: vi.fn(),
  listApplicants: vi.fn(),
  getApplicant: vi.fn(),
  setApplicantStatus: vi.fn(),
}));

import { useSession } from "next-auth/react";
import { ApiError } from "@/lib/api/errors";
import { getJob, getMyPosting } from "@/lib/api/jobPostings";
import {
  applyToJob,
  getApplicant,
  listApplicants,
  listMyApplications,
} from "@/lib/api/jobApplications";

import OpeningDetailPage from "@/app/dashboard/jobs/[id]/page";
import MyApplicationsPage from "@/app/dashboard/applications/page";
import ApplicantsPage from "@/app/(employer)/employer/jobs/[id]/applicants/page";

import {
  ACCESS_TOKEN,
  makeApplicant,
  makeApplication,
  makeJob,
  makePosting,
} from "./test-fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN },
    status: "authenticated",
  } as never);
  vi.mocked(getJob).mockResolvedValue(makeJob());
  vi.mocked(getMyPosting).mockResolvedValue(makePosting());
  vi.mocked(listMyApplications).mockResolvedValue({
    items: [
      makeApplication({ id: "a1", status: "Submitted" }),
      makeApplication({ id: "a2", status: "Viewed" }),
      makeApplication({ id: "a3", status: "Shortlisted", fitLabel: "Strong match" }),
      makeApplication({ id: "a4", status: "NotSelected", fitLabel: "Not yet" }),
    ],
  });
  vi.mocked(listApplicants).mockResolvedValue({
    items: [makeApplicant({ id: "a1" }), makeApplicant({ id: "a2", status: "Shortlisted" })],
  });
  vi.mocked(getApplicant).mockResolvedValue(makeApplicant({ id: "a1", status: "Viewed" }));
});

afterEach(() => cleanup());

function assertCleanCopy(text: string) {
  expect(text).not.toMatch(/evidence/i);
  expect(text).not.toMatch(/proof/i);
  expect(text).not.toMatch(/score/i);
  expect(text).not.toMatch(/rank/i);
  expect(text).not.toMatch(/stars?\b/i);
  expect(text).not.toMatch(/[—–]/);
  expect(text).not.toMatch(/%/);
}

describe("applications copy guard", () => {
  it("student detail: apply, name field, applied state", async () => {
    vi.mocked(applyToJob)
      .mockRejectedValueOnce(new ApiError("application_display_name_required", "x", 400))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(makeApplication());
    const { container } = render(<OpeningDetailPage />);
    await screen.findByRole("heading", { level: 1 });
    assertCleanCopy(container.textContent ?? "");
    // The phone sticky bar also renders a button named "Apply"; the
    // one that submits the form lives inside the apply section.
    const applySection = screen.getByRole("region", { name: "Apply" });
    fireEvent.click(within(applySection).getByRole("button", { name: "Apply" }));
    const input = await screen.findByLabelText("Your name");
    assertCleanCopy(container.textContent ?? "");
    fireEvent.change(input, { target: { value: "Nadia Rahman" } });
    fireEvent.click(within(applySection).getByRole("button", { name: "Apply" }));
    await screen.findByRole("alert");
    assertCleanCopy(container.textContent ?? "");
    fireEvent.click(within(applySection).getByRole("button", { name: "Apply" }));
    await screen.findByText("You applied");
    assertCleanCopy(container.textContent ?? "");
  });

  it("my applications: loaded, empty and error", async () => {
    const loaded = render(<MyApplicationsPage />);
    await screen.findAllByRole("article");
    assertCleanCopy(loaded.container.textContent ?? "");
    cleanup();
    vi.mocked(listMyApplications).mockResolvedValue({ items: [] });
    const empty = render(<MyApplicationsPage />);
    await screen.findByText("You have not applied yet.");
    assertCleanCopy(empty.container.textContent ?? "");
    cleanup();
    vi.mocked(listMyApplications).mockRejectedValue(new Error("x"));
    const failed = render(<MyApplicationsPage />);
    await screen.findByText("Could not load your applications");
    assertCleanCopy(failed.container.textContent ?? "");
  });

  it("employer applicants: list, opened panel, empty and error", async () => {
    const { container } = render(<ApplicantsPage />);
    const cards = await screen.findAllByRole("article");
    assertCleanCopy(container.textContent ?? "");
    fireEvent.click(within(cards[0]).getByRole("button", { name: "Open" }));
    await within(cards[0]).findByRole("region", { name: /Details for/ });
    assertCleanCopy(container.textContent ?? "");
    cleanup();
    vi.mocked(listApplicants).mockResolvedValue({ items: [] });
    const empty = render(<ApplicantsPage />);
    await screen.findByText("No applications yet.");
    assertCleanCopy(empty.container.textContent ?? "");
    cleanup();
    vi.mocked(listApplicants).mockRejectedValue(new Error("x"));
    const failed = render(<ApplicantsPage />);
    await screen.findByText("Could not load applicants");
    assertCleanCopy(failed.container.textContent ?? "");
  });
});
