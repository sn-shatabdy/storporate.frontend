import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "req-1" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api/sponsorshipRequests", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/sponsorshipRequests")>(
    "@/lib/api/sponsorshipRequests",
  );
  return {
    ...actual,
    listReceivedRequests: vi.fn(),
    getReceivedRequest: vi.fn(),
    sendReceivedRequestMessage: vi.fn(),
    acceptRequest: vi.fn(),
    declineRequest: vi.fn(),
    completeReceivedRequest: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import {
  acceptRequest,
  completeReceivedRequest,
  declineRequest,
  getReceivedRequest,
  listReceivedRequests,
  sendReceivedRequestMessage,
} from "@/lib/api/sponsorshipRequests";
import { ApiError } from "@/lib/api/errors";
import {
  ACCESS_TOKEN,
  makeRequestDetail,
  makeRequestMessage,
  makeRequestSummary,
} from "@/components/requests/test-fixtures";

import RequestsPage from "./page";
import RequestPage from "./[id]/page";

const COMPANY_ACTIONS = ["message", "accept", "decline"];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Organization" },
    status: "authenticated",
  } as never);
  vi.mocked(listReceivedRequests).mockResolvedValue({
    items: [
      makeRequestSummary({ counterpartName: "BUET Coding Club" }),
      makeRequestSummary({ id: "req-2", status: "Viewed", counterpartName: "DU Debate Club" }),
    ],
  });
  vi.mocked(getReceivedRequest).mockResolvedValue(
    makeRequestDetail({ status: "Viewed", viewedAt: "2026-09-19T10:00:00Z", allowedActions: COMPANY_ACTIONS }),
  );
});

afterEach(() => cleanup());

describe("company requests list", () => {
  it("shows the club name and marks Sent requests as New", async () => {
    render(<RequestsPage />);
    expect(screen.getByText("Loading requests.")).toBeInTheDocument();
    const cards = await screen.findAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("BUET Coding Club")).toBeInTheDocument();
    expect(within(cards[0]).getByText("New")).toBeInTheDocument();
    expect(within(cards[1]).queryByText("New")).not.toBeInTheDocument();
    expect(within(cards[0]).getByRole("link")).toHaveAttribute("href", "/employer/requests/req-1");
    expect(listReceivedRequests).toHaveBeenCalledWith(ACCESS_TOKEN, null, expect.anything());
  });

  it("filters by status", async () => {
    render(<RequestsPage />);
    await screen.findAllByRole("article");
    fireEvent.click(screen.getByRole("button", { name: "Agreed" }));
    await waitFor(() =>
      expect(listReceivedRequests).toHaveBeenLastCalledWith(ACCESS_TOKEN, "Agreed", expect.anything()),
    );
  });

  it("explains an empty list and links to the goals", async () => {
    vi.mocked(listReceivedRequests).mockResolvedValue({ items: [] });
    render(<RequestsPage />);
    await screen.findByText("No requests yet.");
    expect(screen.getByRole("link", { name: "View your goals" })).toHaveAttribute(
      "href",
      "/employer/sponsorship",
    );
  });

  it("shows an error with retry", async () => {
    vi.mocked(listReceivedRequests).mockRejectedValueOnce(new Error("x"));
    render(<RequestsPage />);
    await screen.findByText("Could not load requests");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findAllByRole("article");
  });
});

describe("company request detail", () => {
  it("shows the club, the event and the viewed status", async () => {
    render(<RequestPage />);
    await screen.findByRole("heading", { level: 1, name: "Dhaka Hack Night" });
    expect(getReceivedRequest).toHaveBeenCalledWith(ACCESS_TOKEN, "req-1", expect.anything());
    expect(screen.getByText("From BUET Coding Club, BUET")).toBeInTheDocument();
    expect(screen.getAllByText("Viewed").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "What the club asks for" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What you get in return" })).toBeInTheDocument();
    expect(screen.getAllByText("BDT 50,000").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Ask a question" })).toBeDisabled();
  });

  it("drives buttons from allowedActions", async () => {
    vi.mocked(getReceivedRequest).mockResolvedValue(
      makeRequestDetail({ status: "Agreed", allowedActions: ["complete"] }),
    );
    render(<RequestPage />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getByRole("button", { name: "Mark as completed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  });

  it("hides every action when none are allowed", async () => {
    vi.mocked(getReceivedRequest).mockResolvedValue(
      makeRequestDetail({ status: "Declined", allowedActions: [] }),
    );
    render(<RequestPage />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as completed" })).not.toBeInTheDocument();
  });

  it("asks a question through the composer", async () => {
    vi.mocked(sendReceivedRequestMessage).mockResolvedValue(
      makeRequestDetail({
        status: "InDiscussion",
        allowedActions: COMPANY_ACTIONS,
        messages: [
          makeRequestMessage(),
          makeRequestMessage({ id: "m-2", from: "Company", body: "How many attend?" }),
        ],
      }),
    );
    render(<RequestPage />);
    await screen.findByLabelText("Message");
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "How many attend?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask a question" }));
    await screen.findByText("How many attend?");
    expect(sendReceivedRequestMessage).toHaveBeenCalledWith(ACCESS_TOKEN, "req-1", "How many attend?");
    const mine = screen.getByText("How many attend?").closest("li");
    expect(mine).toHaveAttribute("data-from", "me");
    const theirs = screen.getByText("We would love to have you on board.").closest("li");
    expect(theirs).toHaveAttribute("data-from", "them");
    expect(screen.getAllByText("In discussion").length).toBeGreaterThan(0);
  });

  it("accepts with an optional note and reloads from the response", async () => {
    vi.mocked(acceptRequest).mockResolvedValue(
      makeRequestDetail({
        status: "Agreed",
        decidedAt: "2026-09-22T10:00:00Z",
        decisionNote: "Welcome aboard.",
        allowedActions: ["message", "complete"],
      }),
    );
    render(<RequestPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    const dialog = screen.getByRole("dialog", { name: "Accept this request" });
    fireEvent.change(within(dialog).getByLabelText(/Note for the club/), {
      target: { value: " Welcome aboard. " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Accept request" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(acceptRequest).toHaveBeenCalledWith(ACCESS_TOKEN, "req-1", "Welcome aboard.");
    expect(screen.getByText("Request accepted.")).toBeInTheDocument();
    expect(screen.getByText("Welcome aboard.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as completed" })).toBeInTheDocument();
  });

  it("accepts without a note", async () => {
    vi.mocked(acceptRequest).mockResolvedValue(
      makeRequestDetail({ status: "Agreed", allowedActions: [] }),
    );
    render(<RequestPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Accept request" }));
    await waitFor(() => expect(acceptRequest).toHaveBeenCalledWith(ACCESS_TOKEN, "req-1", ""));
  });

  it("declines with a reason and disables the button while saving", async () => {
    let resolve: (value: ReturnType<typeof makeRequestDetail>) => void = () => {};
    vi.mocked(declineRequest).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<RequestPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Decline" }));
    const dialog = screen.getByRole("dialog", { name: "Decline this request" });
    fireEvent.change(within(dialog).getByLabelText(/Reason for the club/), {
      target: { value: "Budget is spent." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Decline request" }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Declining…" })).toBeDisabled());
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    resolve(
      makeRequestDetail({
        status: "Declined",
        decisionNote: "Budget is spent.",
        decidedAt: "2026-09-22T10:00:00Z",
        allowedActions: [],
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(declineRequest).toHaveBeenCalledWith(ACCESS_TOKEN, "req-1", "Budget is spent.");
    expect(screen.getByRole("heading", { name: "Reason for declining" })).toBeInTheDocument();
    expect(screen.getByText("Request declined.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Request progress" })).toHaveTextContent("Declined");
  });

  it("shows a dialog error and refreshes on an invalid transition", async () => {
    vi.mocked(acceptRequest).mockRejectedValue(
      new ApiError("sponsorship_request_invalid_transition", "x", 409),
    );
    render(<RequestPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Accept" }));
    const dialog = screen.getByRole("dialog");
    vi.mocked(getReceivedRequest).mockResolvedValue(
      makeRequestDetail({ status: "Declined", allowedActions: [] }),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Accept request" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("cannot move to that step");
    await waitFor(() => expect(getReceivedRequest).toHaveBeenCalledTimes(2));
  });

  it("marks an agreed request completed", async () => {
    vi.mocked(getReceivedRequest).mockResolvedValue(
      makeRequestDetail({ status: "Agreed", allowedActions: ["message", "complete"] }),
    );
    vi.mocked(completeReceivedRequest).mockResolvedValue(
      makeRequestDetail({
        status: "Completed",
        allowedActions: ["message"],
        outcome: { note: "Delivered.", agreedAmount: null },
      }),
    );
    render(<RequestPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark as completed" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Outcome note"), { target: { value: "Delivered." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as completed" }));
    await waitFor(() =>
      expect(completeReceivedRequest).toHaveBeenCalledWith(ACCESS_TOKEN, "req-1", {
        outcomeNote: "Delivered.",
        agreedAmount: null,
      }),
    );
    await screen.findByRole("heading", { name: "Outcome" });
  });

  it("rejects a bad final amount in the complete dialog", async () => {
    vi.mocked(getReceivedRequest).mockResolvedValue(
      makeRequestDetail({ status: "Agreed", allowedActions: ["complete"] }),
    );
    render(<RequestPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark as completed" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Outcome note"), { target: { value: "Done" } });
    fireEvent.change(within(dialog).getByLabelText(/Final amount/), { target: { value: "-5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as completed" }));
    expect(within(dialog).getByText(/Enter a whole amount/)).toBeInTheDocument();
    expect(completeReceivedRequest).not.toHaveBeenCalled();
  });

  it("closes a dialog with Escape", async () => {
    render(<RequestPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Decline" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(declineRequest).not.toHaveBeenCalled();
  });

  it("shows not found and error states", async () => {
    vi.mocked(getReceivedRequest).mockRejectedValueOnce(
      new ApiError("sponsorship_request_not_found", "x", 404),
    );
    const view = render(<RequestPage />);
    await screen.findByText("This request was not found");
    view.unmount();
    vi.mocked(getReceivedRequest).mockRejectedValueOnce(new Error("x"));
    render(<RequestPage />);
    await screen.findByText("Could not load this request");
  });
});
