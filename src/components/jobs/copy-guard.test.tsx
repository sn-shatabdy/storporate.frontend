import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const routerMock = { push: vi.fn(), replace: vi.fn() };

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/employer/jobs",
  useSearchParams: () => new URLSearchParams("saved=created"),
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
  return {
    ...actual,
    listMyPostings: vi.fn(),
    getMyPosting: vi.fn(),
    listJobs: vi.fn(),
    getJob: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import { getJob, getMyPosting, listJobs, listMyPostings } from "@/lib/api/jobPostings";

import EmployerJobsPage from "@/app/(employer)/employer/jobs/page";
import NewPostingPage from "@/app/(employer)/employer/jobs/new/page";
import EditPostingPage from "@/app/(employer)/employer/jobs/[id]/edit/page";
import OpeningsPage from "@/app/dashboard/jobs/page";
import OpeningDetailPage from "@/app/dashboard/jobs/[id]/page";

import { ACCESS_TOKEN, makeJob, makePosting } from "./test-fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN },
    status: "authenticated",
  } as never);
  vi.mocked(listMyPostings).mockResolvedValue({
    items: [
      makePosting({ id: "a", status: "Open" }),
      makePosting({ id: "b", status: "Paused" }),
      makePosting({ id: "c", status: "Closed" }),
    ],
    counts: { open: 1, paused: 1, closed: 1, total: 3 },
  });
  vi.mocked(getMyPosting).mockResolvedValue(makePosting());
  vi.mocked(listJobs).mockResolvedValue({
    items: [
      makeJob({ id: "j1" }),
      makeJob({ id: "j2", fit: { label: "Not yet", matched: [], missing: ["SQL", "Excel"] } }),
    ],
  });
  vi.mocked(getJob).mockResolvedValue(makeJob());
});

afterEach(() => cleanup());

function assertCleanCopy(text: string) {
  expect(text).not.toMatch(/evidence/i);
  expect(text).not.toMatch(/proof/i);
  expect(text).not.toMatch(/score/i);
  expect(text).not.toMatch(/[—–]/);
  expect(text).not.toMatch(/%/);
  expect(text).not.toMatch(/\d\s*%/);
}

describe("copy guard", () => {
  it("employer list with close dialog open", async () => {
    const { container } = render(<EmployerJobsPage />);
    await screen.findAllByRole("article");
    const more = await screen.findAllByRole("button", { name: /More actions/ });
    fireEvent.click(more[0]);
    const closeItem = await screen.findByRole("menuitem", { name: "Close opening" });
    fireEvent.click(closeItem);
    await screen.findByRole("dialog");
    assertCleanCopy(container.textContent ?? "");
  });

  it("employer new form with errors", async () => {
    const { container } = render(<NewPostingPage />);
    fireEvent.click(screen.getByRole("button", { name: "Post opening" }));
    assertCleanCopy(container.textContent ?? "");
  });

  it("employer edit form and closed view", async () => {
    const open = render(<EditPostingPage />);
    await screen.findByLabelText("Title");
    assertCleanCopy(open.container.textContent ?? "");
    cleanup();
    vi.mocked(getMyPosting).mockResolvedValue(makePosting({ status: "Closed" }));
    const closed = render(<EditPostingPage />);
    await screen.findByText(/This opening is closed/);
    assertCleanCopy(closed.container.textContent ?? "");
  });

  it("student list", async () => {
    const { container } = render(<OpeningsPage />);
    await screen.findAllByRole("article");
    assertCleanCopy(container.textContent ?? "");
  });

  it("student detail", async () => {
    const { container } = render(<OpeningDetailPage />);
    await screen.findByRole("heading", { level: 1 });
    assertCleanCopy(container.textContent ?? "");
  });

  it("empty and error states", async () => {
    vi.mocked(listJobs).mockResolvedValue({ items: [] });
    const a = render(<OpeningsPage />);
    await screen.findByText("No openings yet");
    assertCleanCopy(a.container.textContent ?? "");
    cleanup();
    vi.mocked(listMyPostings).mockRejectedValue(new Error("x"));
    const b = render(<EmployerJobsPage />);
    await screen.findByText(/Could not load your openings/);
    assertCleanCopy(b.container.textContent ?? "");
  });
});