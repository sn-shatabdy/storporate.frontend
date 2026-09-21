import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/club/requests",
  useParams: () => ({ id: "req-1" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api/sponsorship", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/sponsorship")>("@/lib/api/sponsorship");
  return { ...actual, getCompanyGoal: vi.fn() };
});
vi.mock("@/lib/api/sponsorshipRequests", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/sponsorshipRequests")>(
    "@/lib/api/sponsorshipRequests",
  );
  return {
    ...actual,
    createRequest: vi.fn(),
    listSentRequests: vi.fn(),
    getSentRequest: vi.fn(),
    listReceivedRequests: vi.fn(),
    getReceivedRequest: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import { getCompanyGoal } from "@/lib/api/sponsorship";
import {
  createRequest,
  getReceivedRequest,
  getSentRequest,
  listReceivedRequests,
  listSentRequests,
  REQUEST_STATUSES,
} from "@/lib/api/sponsorshipRequests";
import { ApiError } from "@/lib/api/errors";
import { makeDetail } from "@/components/sponsorship/test-fixtures";

import RequestFormPage from "@/app/(club)/club/sponsors/[id]/request/page";
import ClubRequestsPage from "@/app/(club)/club/requests/page";
import ClubRequestPage from "@/app/(club)/club/requests/[id]/page";
import EmployerRequestsPage from "@/app/(employer)/employer/requests/page";
import EmployerRequestPage from "@/app/(employer)/employer/requests/[id]/page";
import { ClubNav, EmployerNav } from "@/components/layout/header";

import { RequestProgress } from "./request-progress";
import { RequestStatusPill } from "./status-pill";
import {
  ACCESS_TOKEN,
  makeRequestDetail,
  makeRequestSummary,
} from "./test-fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Club" },
    status: "authenticated",
  } as never);
  vi.mocked(getCompanyGoal).mockResolvedValue(makeDetail());
  vi.mocked(listSentRequests).mockResolvedValue({ items: [makeRequestSummary()] });
  vi.mocked(listReceivedRequests).mockResolvedValue({ items: [makeRequestSummary()] });
  vi.mocked(getSentRequest).mockResolvedValue(
    makeRequestDetail({
      status: "Agreed",
      decisionNote: "Happy to help.",
      allowedActions: ["message", "complete"],
    }),
  );
  vi.mocked(getReceivedRequest).mockResolvedValue(
    makeRequestDetail({
      status: "Viewed",
      allowedActions: ["message", "accept", "decline", "complete"],
    }),
  );
});

afterEach(() => cleanup());

function assertCleanCopy(text: string) {
  expect(text.length).toBeGreaterThan(0);
  expect(text).not.toMatch(/evidence/i);
  expect(text).not.toMatch(/proof/i);
  expect(text).not.toMatch(/score/i);
  expect(text).not.toMatch(/[—–]/);
  expect(text).not.toMatch(/%/);
}

/** Text of the page plus any open dialog, which renders in a portal. */
function pageText(container: HTMLElement): string {
  return `${container.textContent ?? ""} ${document.body.textContent ?? ""}`;
}

describe("sponsorship requests copy guard", () => {
  it("request form, empty, with errors and every server problem", async () => {
    const view = render(<RequestFormPage />);
    await screen.findByRole("button", { name: "Send request" });
    assertCleanCopy(pageText(view.container));
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    assertCleanCopy(pageText(view.container));

    const codes: [string, number][] = [
      ["sponsorship_request_duplicate", 409],
      ["club_profile_not_found", 404],
      ["club_profile_not_published", 409],
      ["sponsorship_request_closed", 409],
      ["sponsorship_request_thread_full", 409],
      ["sponsorship_request_invalid_transition", 409],
      ["sponsorship_request_status_invalid", 400],
      ["sponsorship_request_not_found", 404],
    ];
    for (const [code, status] of codes) {
      vi.mocked(createRequest).mockRejectedValue(new ApiError(code, "x", status));
      fireEvent.change(screen.getByLabelText("Event title"), { target: { value: "Hack Night" } });
      fireEvent.change(screen.getByLabelText("About the event"), {
        target: { value: "A twelve hour hackathon for students." },
      });
      fireEvent.change(screen.getByLabelText("What you are asking for"), {
        target: { value: "Cash for prizes." },
      });
      fireEvent.change(screen.getByLabelText("What the company gets in return"), {
        target: { value: "Logo on banners." },
      });
      fireEvent.click(screen.getByRole("button", { name: "Send request" }));
      const alert = await screen.findByRole("alert");
      assertCleanCopy(alert.textContent ?? "");
    }
    cleanup();

    vi.mocked(getCompanyGoal).mockRejectedValue(new ApiError("sponsorship_goal_not_found", "x", 404));
    const missing = render(<RequestFormPage />);
    await screen.findByText("This goal set is not available.");
    assertCleanCopy(missing.container.textContent ?? "");
  });

  it("club list, filtered empty, empty and error", async () => {
    const list = render(<ClubRequestsPage />);
    await screen.findByRole("article");
    assertCleanCopy(list.container.textContent ?? "");
    vi.mocked(listSentRequests).mockResolvedValue({ items: [] });
    fireEvent.click(screen.getByRole("button", { name: "Agreed" }));
    await screen.findByText("No requests with this status.");
    assertCleanCopy(list.container.textContent ?? "");
    cleanup();

    const empty = render(<ClubRequestsPage />);
    await screen.findByText("No requests yet.");
    assertCleanCopy(empty.container.textContent ?? "");
    cleanup();

    vi.mocked(listSentRequests).mockRejectedValue(new Error("x"));
    const failed = render(<ClubRequestsPage />);
    await screen.findByText("Could not load your requests");
    assertCleanCopy(failed.container.textContent ?? "");
  });

  it("company list, empty and error", async () => {
    const list = render(<EmployerRequestsPage />);
    await screen.findByRole("article");
    assertCleanCopy(list.container.textContent ?? "");
    cleanup();

    vi.mocked(listReceivedRequests).mockResolvedValue({ items: [] });
    const empty = render(<EmployerRequestsPage />);
    await screen.findByText("No requests yet.");
    assertCleanCopy(empty.container.textContent ?? "");
    cleanup();

    vi.mocked(listReceivedRequests).mockRejectedValue(new Error("x"));
    const failed = render(<EmployerRequestsPage />);
    await screen.findByText("Could not load requests");
    assertCleanCopy(failed.container.textContent ?? "");
  });

  it("club detail with its complete dialog, and not found", async () => {
    const detail = render(<ClubRequestPage />);
    await screen.findByRole("heading", { level: 1 });
    assertCleanCopy(detail.container.textContent ?? "");
    fireEvent.click(screen.getByRole("button", { name: "Mark as completed" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as completed" }));
    assertCleanCopy(pageText(detail.container));
    cleanup();

    vi.mocked(getSentRequest).mockRejectedValue(new ApiError("sponsorship_request_not_found", "x", 404));
    const missing = render(<ClubRequestPage />);
    await screen.findByText("This request was not found");
    assertCleanCopy(missing.container.textContent ?? "");
  });

  it("company detail with accept, decline and complete dialogs", async () => {
    const detail = render(<EmployerRequestPage />);
    await screen.findByRole("heading", { level: 1 });
    assertCleanCopy(detail.container.textContent ?? "");
    for (const name of ["Accept", "Decline", "Mark as completed"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      assertCleanCopy(pageText(detail.container));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    }
  });

  it("every status pill and progress track, plus the navs", () => {
    const all = render(
      <>
        {REQUEST_STATUSES.map((status) => (
          <div key={status}>
            <RequestStatusPill status={status} />
            <RequestProgress status={status} />
          </div>
        ))}
        <EmployerNav isSearchActive={false} isRequestsActive />
        <ClubNav isProfileActive={false} isRequestsActive />
      </>,
    );
    assertCleanCopy(all.container.textContent ?? "");
  });
});
