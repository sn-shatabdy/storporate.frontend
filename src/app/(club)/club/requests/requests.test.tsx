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
    listSentRequests: vi.fn(),
    getSentRequest: vi.fn(),
    sendSentRequestMessage: vi.fn(),
    completeSentRequest: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import {
  completeSentRequest,
  getSentRequest,
  listSentRequests,
  sendSentRequestMessage,
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

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Club" },
    status: "authenticated",
  } as never);
  vi.mocked(listSentRequests).mockResolvedValue({ items: [makeRequestSummary()] });
  vi.mocked(getSentRequest).mockResolvedValue(makeRequestDetail());
});

afterEach(() => cleanup());

describe("club requests list", () => {
  it("shows a skeleton then the cards", async () => {
    render(<RequestsPage />);
    expect(screen.getByText("Loading your requests.")).toBeInTheDocument();
    const card = await screen.findByRole("article");
    expect(within(card).getByRole("heading", { name: "Dhaka Hack Night" })).toBeInTheDocument();
    expect(within(card).getByText("Acme Ltd")).toBeInTheDocument();
    expect(within(card).getByText(/Campus hiring/)).toBeInTheDocument();
    expect(within(card).getByText("Sent")).toBeInTheDocument();
    expect(within(card).getByText("BDT 50,000")).toBeInTheDocument();
    expect(within(card).getByText("Event Nov 14, 2026")).toBeInTheDocument();
    expect(within(card).getByText("Updated Sep 20, 2026")).toBeInTheDocument();
    expect(within(card).getByText("2 messages")).toBeInTheDocument();
    expect(within(card).getByRole("link")).toHaveAttribute("href", "/club/requests/req-1");
    expect(within(card).queryByText("New")).not.toBeInTheDocument();
    expect(listSentRequests).toHaveBeenCalledWith(ACCESS_TOKEN, null, expect.anything());
  });

  it("filters by status with pressed chips", async () => {
    render(<RequestsPage />);
    await screen.findByRole("article");
    const group = screen.getByRole("group", { name: "Filter by status" });
    const names = within(group).getAllByRole("button").map((b) => b.textContent);
    expect(names).toEqual(["All", "Sent", "Viewed", "In discussion", "Agreed", "Declined", "Completed"]);
    expect(within(group).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(group).getByRole("button", { name: "In discussion" }));
    await waitFor(() =>
      expect(listSentRequests).toHaveBeenLastCalledWith(ACCESS_TOKEN, "InDiscussion", expect.anything()),
    );
    expect(within(group).getByRole("button", { name: "In discussion" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await screen.findByRole("article");
  });

  it("explains an empty list and links to sponsors", async () => {
    vi.mocked(listSentRequests).mockResolvedValue({ items: [] });
    render(<RequestsPage />);
    await screen.findByText("No requests yet.");
    expect(screen.getByRole("link", { name: "Find sponsors" })).toHaveAttribute(
      "href",
      "/club/sponsors",
    );
  });

  it("shows a filtered empty state with a way back", async () => {
    render(<RequestsPage />);
    await screen.findByRole("article");
    vi.mocked(listSentRequests).mockResolvedValue({ items: [] });
    fireEvent.click(screen.getByRole("button", { name: "Declined" }));
    await screen.findByText("No requests with this status.");
    vi.mocked(listSentRequests).mockResolvedValue({ items: [makeRequestSummary()] });
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    await screen.findByRole("article");
    expect(listSentRequests).toHaveBeenLastCalledWith(ACCESS_TOKEN, null, expect.anything());
  });

  it("shows an error with retry", async () => {
    vi.mocked(listSentRequests).mockRejectedValueOnce(new Error("x"));
    render(<RequestsPage />);
    await screen.findByText("Could not load your requests");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("article");
  });
});

describe("club request detail", () => {
  it("shows the summary, progress and conversation", async () => {
    render(<RequestPage />);
    expect(screen.getByText("Loading the request.")).toBeInTheDocument();
    await screen.findByRole("heading", { level: 1, name: "Dhaka Hack Night" });
    expect(getSentRequest).toHaveBeenCalledWith(ACCESS_TOKEN, "req-1", expect.anything());
    expect(screen.getByText("To Acme Ltd, Campus hiring")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Request progress" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What you are asking for" })).toBeInTheDocument();
    expect(screen.getByText("Cash support for prizes and venue costs.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What the company gets in return" })).toBeInTheDocument();
    expect(screen.getByText("We would love to have you on board.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Requests/ })).toHaveAttribute("href", "/club/requests");
  });

  it("hides the composer and the complete button without those actions", async () => {
    vi.mocked(getSentRequest).mockResolvedValue(makeRequestDetail({ status: "Declined", allowedActions: [] }));
    render(<RequestPage />);
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as completed" })).not.toBeInTheDocument();
    expect(screen.getByText("Messages are closed for this request.")).toBeInTheDocument();
  });

  it("sends a message and shows the returned thread", async () => {
    vi.mocked(sendSentRequestMessage).mockResolvedValue(
      makeRequestDetail({
        messages: [makeRequestMessage(), makeRequestMessage({ id: "m-2", body: "Following up." })],
      }),
    );
    render(<RequestPage />);
    await screen.findByLabelText("Message");
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "  Following up.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Following up.");
    expect(sendSentRequestMessage).toHaveBeenCalledWith(ACCESS_TOKEN, "req-1", "Following up.");
    expect(screen.getByLabelText("Message")).toHaveValue("");
    expect(screen.getByText("Message sent.")).toBeInTheDocument();
  });

  it("shows an inline error and refreshes when the request closed", async () => {
    vi.mocked(sendSentRequestMessage).mockRejectedValue(
      new ApiError("sponsorship_request_closed", "x", 409),
    );
    render(<RequestPage />);
    await screen.findByLabelText("Message");
    vi.mocked(getSentRequest).mockResolvedValue(
      makeRequestDetail({ status: "Declined", allowedActions: [] }),
    );
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("This request is closed. It cannot be changed.");
    await waitFor(() => expect(getSentRequest).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByLabelText("Message")).not.toBeInTheDocument());
  });

  it("keeps Send disabled for an empty or too long message", async () => {
    render(<RequestPage />);
    await screen.findByLabelText("Message");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "x".repeat(2001) } });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("shows the decision note and the outcome when present", async () => {
    vi.mocked(getSentRequest).mockResolvedValue(
      makeRequestDetail({
        status: "Completed",
        decidedAt: "2026-09-22T10:00:00Z",
        completedAt: "2026-11-20T10:00:00Z",
        decisionNote: "Happy to help.",
        outcome: { note: "Banners delivered.", agreedAmount: 40000 },
        allowedActions: ["message"],
      }),
    );
    render(<RequestPage />);
    await screen.findByRole("heading", { name: "Note on the decision" });
    expect(screen.getByText("Happy to help.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Outcome" })).toBeInTheDocument();
    expect(screen.getByText("Banners delivered.")).toBeInTheDocument();
    expect(screen.getByText("Final amount: BDT 40,000")).toBeInTheDocument();
  });

  it("offers Mark as completed only with the complete action and submits it", async () => {
    vi.mocked(getSentRequest).mockResolvedValue(
      makeRequestDetail({ status: "Agreed", allowedActions: ["message", "complete"] }),
    );
    vi.mocked(completeSentRequest).mockResolvedValue(
      makeRequestDetail({
        status: "Completed",
        allowedActions: ["message"],
        outcome: { note: "It went well.", agreedAmount: 45000 },
        completedAt: "2026-11-20T10:00:00Z",
      }),
    );
    render(<RequestPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark as completed" }));
    const dialog = screen.getByRole("dialog", { name: "Mark as completed" });

    // The note is required.
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as completed" }));
    expect(within(dialog).getByText("Write a short outcome note.")).toBeInTheDocument();
    expect(completeSentRequest).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("Outcome note"), { target: { value: " It went well. " } });
    fireEvent.change(within(dialog).getByLabelText(/Final amount/), { target: { value: "45000" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as completed" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(completeSentRequest).toHaveBeenCalledWith(ACCESS_TOKEN, "req-1", {
      outcomeNote: "It went well.",
      agreedAmount: 45000,
    });
    expect(screen.getByText("Marked as completed.")).toBeInTheDocument();
    expect(screen.getByText("Final amount: BDT 45,000")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark as completed" })).not.toBeInTheDocument();
  });

  it("shows a dialog error when completing fails", async () => {
    vi.mocked(getSentRequest).mockResolvedValue(
      makeRequestDetail({ status: "Agreed", allowedActions: ["complete"] }),
    );
    vi.mocked(completeSentRequest).mockRejectedValue(
      new ApiError("sponsorship_request_invalid_transition", "x", 409),
    );
    render(<RequestPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark as completed" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Outcome note"), { target: { value: "Done" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as completed" }));
    await within(dialog).findByRole("alert");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("cannot move to that step");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows not found", async () => {
    vi.mocked(getSentRequest).mockRejectedValue(
      new ApiError("sponsorship_request_not_found", "x", 404),
    );
    render(<RequestPage />);
    await screen.findByText("This request was not found");
  });

  it("shows an error with retry", async () => {
    vi.mocked(getSentRequest).mockRejectedValueOnce(new Error("x"));
    render(<RequestPage />);
    await screen.findByText("Could not load this request");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { level: 1, name: "Dhaka Hack Night" });
  });
});
