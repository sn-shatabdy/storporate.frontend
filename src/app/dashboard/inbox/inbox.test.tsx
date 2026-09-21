import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: vi.fn(),
}));
vi.mock("@/lib/api/outreach", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/outreach")>(
    "@/lib/api/outreach",
  );
  return {
    ...actual,
    listInbox: vi.fn(),
    getInboxConversation: vi.fn(),
    replyToInvitation: vi.fn(),
    declineInvitation: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import {
  declineInvitation,
  getInboxConversation,
  listInbox,
  replyToInvitation,
} from "@/lib/api/outreach";
import {
  ACCESS_TOKEN,
  makeDetail,
  makeMessage,
  makeSummary,
} from "@/components/outreach/test-fixtures";

import InboxPage from "./page";
import InboxConversationPage from "./[id]/page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN },
    status: "authenticated",
  } as never);
  vi.mocked(useParams).mockReturnValue({ id: "conv-1" } as never);
});

afterEach(() => cleanup());

const studentDetail = (overrides = {}) =>
  makeDetail({
    counterpartName: "Acme Analytics",
    messages: [
      makeMessage({ id: "m1", senderRole: "Organization", fromMe: false, body: "We liked your dashboard." }),
    ],
    ...overrides,
  });

describe("student inbox list", () => {
  it("shows loading, then organizations with status and preview", async () => {
    vi.mocked(listInbox).mockResolvedValue({
      items: [makeSummary({ counterpartName: "Acme Analytics" })],
    });
    render(<InboxPage />);
    expect(screen.getByText("Loading your inbox.")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Acme Analytics" })).toHaveAttribute(
      "href",
      "/dashboard/inbox/conv-1",
    );
    expect(screen.getByText("Invited")).toBeInTheDocument();
    expect(screen.getByText("We liked your sales dashboard.")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    vi.mocked(listInbox).mockResolvedValue({ items: [] });
    render(<InboxPage />);
    expect(await screen.findByText("No messages yet.")).toBeInTheDocument();
  });

  it("shows an error and retries", async () => {
    vi.mocked(listInbox).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(listInbox).mockResolvedValueOnce({ items: [] });
    render(<InboxPage />);
    expect(await screen.findByText("Could not load your inbox")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("No messages yet.")).toBeInTheDocument();
  });
});

describe("student conversation thread", () => {
  it("Invited: shows the invitation, the privacy line, a reply composer and Decline", async () => {
    vi.mocked(getInboxConversation).mockResolvedValue(studentDetail());
    render(<InboxConversationPage />);
    expect(await screen.findByText("We liked your dashboard.")).toBeInTheDocument();
    expect(
      screen.getByText("The organization cannot see your email or contact details."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Acme Analytics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("replies and shows the updated thread", async () => {
    const invited = studentDetail();
    vi.mocked(getInboxConversation).mockResolvedValue(invited);
    vi.mocked(replyToInvitation).mockResolvedValue({
      ...invited,
      status: "Replied",
      messages: [
        ...invited.messages,
        makeMessage({ id: "m2", senderRole: "Student", body: "Yes, I am interested.", fromMe: true }),
      ],
    });
    render(<InboxConversationPage />);
    fireEvent.change(await screen.findByLabelText("Message"), {
      target: { value: "Yes, I am interested." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    expect(await screen.findByText("Yes, I am interested.", { selector: "p" })).toBeInTheDocument();
    expect(replyToInvitation).toHaveBeenCalledWith(ACCESS_TOKEN, "conv-1", "Yes, I am interested.");
    expect(screen.getByText("Replied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("Replied: shows the composer and Decline", async () => {
    vi.mocked(getInboxConversation).mockResolvedValue(studentDetail({ status: "Replied" }));
    render(<InboxConversationPage />);
    expect(await screen.findByLabelText("Message")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("asks for confirmation before declining, and Cancel keeps it open", async () => {
    vi.mocked(getInboxConversation).mockResolvedValue(studentDetail());
    render(<InboxConversationPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Decline" }));
    expect(screen.getByText(/This is final/)).toBeInTheDocument();
    expect(declineInvitation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/This is final/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
  });

  it("declines after confirming and becomes read only", async () => {
    vi.mocked(getInboxConversation).mockResolvedValue(studentDetail());
    vi.mocked(declineInvitation).mockResolvedValue(studentDetail({ status: "Declined" }));
    render(<InboxConversationPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Decline" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, decline" }));
    expect(await screen.findByText("You declined this invitation.")).toBeInTheDocument();
    expect(declineInvitation).toHaveBeenCalledWith(ACCESS_TOKEN, "conv-1");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Decline" })).not.toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
  });

  it("shows an error when declining fails", async () => {
    vi.mocked(getInboxConversation).mockResolvedValue(studentDetail());
    vi.mocked(declineInvitation).mockRejectedValue(new Error("boom"));
    render(<InboxConversationPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Decline" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes, decline" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not decline this invitation. Try again.",
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Yes, decline" })).toBeEnabled());
  });

  it("Declined: read only", async () => {
    vi.mocked(getInboxConversation).mockResolvedValue(studentDetail({ status: "Declined" }));
    render(<InboxConversationPage />);
    expect(await screen.findByText("You declined this invitation.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Send/ })).not.toBeInTheDocument();
  });
});
