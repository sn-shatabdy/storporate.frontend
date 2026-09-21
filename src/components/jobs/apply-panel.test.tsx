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
vi.mock("@/lib/api/jobApplications", () => ({
  applyToJob: vi.fn(),
  listMyApplications: vi.fn(),
}));

import { useSession } from "next-auth/react";
import { ApiError } from "@/lib/api/errors";
import { applyToJob, listMyApplications } from "@/lib/api/jobApplications";

import { ApplyPanel, APPLY_NOTE } from "./apply-panel";
import { ACCESS_TOKEN, makeApplication } from "./test-fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Student" },
    status: "authenticated",
  } as never);
});

afterEach(() => cleanup());

describe("ApplyPanel", () => {
  it("shows the Apply button and the privacy line when not applied", () => {
    render(<ApplyPanel jobId="job-1" initial={null} />);
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    expect(screen.getByText(APPLY_NOTE)).toBeInTheDocument();
    expect(screen.queryByLabelText("Your name")).not.toBeInTheDocument();
  });

  it("applies in one action and switches to the applied state", async () => {
    vi.mocked(applyToJob).mockResolvedValue(makeApplication({ status: "Submitted" }));
    render(<ApplyPanel jobId="job-1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("You applied")).toBeInTheDocument();
    expect(applyToJob).toHaveBeenCalledWith(ACCESS_TOKEN, "job-1", undefined);
    expect(screen.getByText("Submitted")).toHaveClass(
      "bg-secondary",
      "text-muted-foreground",
    );
    expect(screen.getByRole("link", { name: "View your applications" })).toHaveAttribute(
      "href",
      "/dashboard/applications",
    );
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
  });

  it("shows a busy button while the request is pending", async () => {
    let resolve!: (v: ReturnType<typeof makeApplication>) => void;
    vi.mocked(applyToJob).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<ApplyPanel jobId="job-1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    const busy = await screen.findByRole("button", { name: "Applying…" });
    expect(busy).toBeDisabled();
    fireEvent.click(busy);
    expect(applyToJob).toHaveBeenCalledTimes(1);
    resolve(makeApplication());
    expect(await screen.findByText("You applied")).toBeInTheDocument();
  });

  it("starts in the applied state when the opening already has an application", () => {
    render(
      <ApplyPanel jobId="job-1" initial={{ id: "app-1", status: "Shortlisted" }} />,
    );
    expect(screen.getByText("You applied")).toBeInTheDocument();
    expect(screen.getByText("Shortlisted")).toHaveClass(
      "bg-success-soft",
      "text-success",
    );
  });

  it("shows the applied state with the real status on a 409", async () => {
    vi.mocked(applyToJob).mockRejectedValue(
      new ApiError("application_already_submitted", "x", 409),
    );
    vi.mocked(listMyApplications).mockResolvedValue({
      items: [makeApplication({ jobPostingId: "job-1", status: "Viewed" })],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    render(<ApplyPanel jobId="job-1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("You applied")).toBeInTheDocument();
    expect(screen.getByText("Viewed")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("falls back to Submitted on a 409 when the lookup fails", async () => {
    vi.mocked(applyToJob).mockRejectedValue(
      new ApiError("application_already_submitted", "x", 409),
    );
    vi.mocked(listMyApplications).mockRejectedValue(new Error("boom"));
    render(<ApplyPanel jobId="job-1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("You applied")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("reveals the name field when a name is required and resubmits with it", async () => {
    vi.mocked(applyToJob)
      .mockRejectedValueOnce(new ApiError("application_display_name_required", "x", 400))
      .mockResolvedValueOnce(makeApplication());
    render(<ApplyPanel jobId="job-1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const input = await screen.findByLabelText("Your name");
    expect(screen.getByText("Employers see this name on your application.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(applyToJob).toHaveBeenCalledWith(ACCESS_TOKEN, "job-1", undefined);

    fireEvent.change(input, { target: { value: "Nadia Rahman" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText("You applied")).toBeInTheDocument();
    expect(applyToJob).toHaveBeenLastCalledWith(ACCESS_TOKEN, "job-1", "Nadia Rahman");
  });

  it("asks for a name before resubmitting an empty field", async () => {
    vi.mocked(applyToJob).mockRejectedValueOnce(
      new ApiError("application_display_name_required", "x", 400),
    );
    render(<ApplyPanel jobId="job-1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await screen.findByLabelText("Your name");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter your name to apply.");
    expect(applyToJob).toHaveBeenCalledTimes(1);
  });

  it("shows an invalid name error and keeps the field", async () => {
    vi.mocked(applyToJob).mockRejectedValueOnce(
      new ApiError("application_display_name_invalid", "x", 400),
    );
    render(<ApplyPanel jobId="job-1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/not valid/);
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
  });

  it("shows a generic error with role alert and allows another try", async () => {
    vi.mocked(applyToJob)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(makeApplication());
    render(<ApplyPanel jobId="job-1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not send your application. Try again.",
    );
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(screen.getByText("You applied")).toBeInTheDocument());
  });

  it("explains a missing opening", async () => {
    vi.mocked(applyToJob).mockRejectedValue(new ApiError("job_posting_not_found", "x", 404));
    render(<ApplyPanel jobId="job-1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This opening is no longer available.",
    );
  });

  it("shows the deadline-passed callout and disabled button on job_posting_deadline_passed", async () => {
    vi.mocked(applyToJob).mockRejectedValueOnce(
      new ApiError("job_posting_deadline_passed", "x", 409),
    );
    render(<ApplyPanel jobId="job-1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    // The deadline-passed card uses role="status" with an inner alert callout
    // and a disabled "Applications closed" button — no normal Apply button.
    await screen.findByRole("button", { name: "Applications closed" });
    expect(
      screen.getByText(/The deadline for this opening has passed\./),
    ).toBeInTheDocument();
    const closed = screen.getByRole("button", { name: "Applications closed" });
    expect(closed).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Apply" })).not.toBeInTheDocument();
    // The dashboard link to "View your applications" only appears in the
    // applied state, not the deadline-passed state.
    expect(
      screen.queryByRole("link", { name: "View your applications" }),
    ).not.toBeInTheDocument();
  });

  it("retrying after a deadline-passed error stays on the deadline-passed state", async () => {
    vi.mocked(applyToJob).mockRejectedValue(
      new ApiError("job_posting_deadline_passed", "x", 409),
    );
    render(<ApplyPanel jobId="job-1" initial={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByRole("button", { name: "Applications closed" }),
    ).toBeDisabled();
    // The deadline-passed state replaces the form entirely, so there is
    // nothing left to click — the callout is the terminal UI.
    expect(applyToJob).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/no longer accepting applications/),
    ).toBeInTheDocument();
  });
});
