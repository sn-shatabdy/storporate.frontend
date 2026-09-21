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
    listMyOutreach: vi.fn(),
    getOutreach: vi.fn(),
    sendOutreachMessage: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { getOutreach, listMyOutreach, sendOutreachMessage } from "@/lib/api/outreach";
import {
  ACCESS_TOKEN,
  makeDetail,
  makeMessage,
  makeSummary,
} from "@/components/outreach/test-fixtures";

import MessagesPage from "./page";
import ConversationPage from "./[id]/page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN },
    status: "authenticated",
  } as never);
  vi.mocked(useParams).mockReturnValue({ id: "conv-1" } as never);
});

afterEach(() => cleanup());

describe("employer messages list", () => {
  it("shows loading, then conversations with status, preview and link", async () => {
    vi.mocked(listMyOutreach).mockResolvedValue({
      items: [
        makeSummary(),
        makeSummary({
          id: "conv-2",
          counterpartName: "Arif Hasan",
          status: "Declined",
          lastMessagePreview: "Thanks for reaching out.",
        }),
      ],
    });
    render(<MessagesPage />);
    expect(screen.getByText("Loading your messages.")).toBeInTheDocument();
    expect(await screen.findByText("Nadia Rahman")).toBeInTheDocument();
    expect(screen.getByText("Invited")).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
    expect(screen.getByText("We liked your sales dashboard.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nadia Rahman" })).toHaveAttribute(
      "href",
      "/employer/messages/conv-1",
    );
  });

  it("shows the empty state", async () => {
    vi.mocked(listMyOutreach).mockResolvedValue({ items: [] });
    render(<MessagesPage />);
    expect(await screen.findByText("No conversations yet.")).toBeInTheDocument();
  });

  it("shows an error and retries", async () => {
    vi.mocked(listMyOutreach).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(listMyOutreach).mockResolvedValueOnce({ items: [] });
    render(<MessagesPage />);
    expect(await screen.findByText("Could not load your messages")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("No conversations yet.")).toBeInTheDocument();
  });
});

describe("employer conversation thread", () => {
  it("Invited: shows the waiting line and no composer", async () => {
    vi.mocked(getOutreach).mockResolvedValue(makeDetail({ status: "Invited" }));
    render(<ConversationPage />);
    expect(await screen.findByText("Waiting for the student to reply.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nadia Rahman" })).toBeInTheDocument();
    expect(screen.getByText("Invited")).toBeInTheDocument();
    expect(getOutreach).toHaveBeenCalledWith(ACCESS_TOKEN, "conv-1", expect.anything());
  });

  it("puts my messages on the right and theirs on the left", async () => {
    vi.mocked(getOutreach).mockResolvedValue(
      makeDetail({
        status: "Replied",
        messages: [
          makeMessage({ id: "m1", body: "Hello there", fromMe: true }),
          makeMessage({
            id: "m2",
            senderRole: "Student",
            body: "Happy to talk",
            fromMe: false,
          }),
        ],
      }),
    );
    const { container } = render(<ConversationPage />);
    await screen.findByText("Happy to talk");
    const rows = container.querySelectorAll("li[data-from]");
    expect(rows[0]).toHaveAttribute("data-from", "me");
    expect(rows[0].className).toContain("items-end");
    expect(rows[1]).toHaveAttribute("data-from", "them");
    expect(rows[1].className).toContain("items-start");
  });

  it("Replied: shows the composer and sends a message", async () => {
    const replied = makeDetail({ status: "Replied" });
    vi.mocked(getOutreach).mockResolvedValue(replied);
    vi.mocked(sendOutreachMessage).mockResolvedValue({
      ...replied,
      messages: [...replied.messages, makeMessage({ id: "m9", body: "Can we talk Monday?" })],
    });
    render(<ConversationPage />);
    const box = await screen.findByLabelText("Message");
    expect(screen.queryByText("Waiting for the student to reply.")).not.toBeInTheDocument();
    fireEvent.change(box, { target: { value: "Can we talk Monday?" } });
    expect(screen.getByText("19 of 2000")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Can we talk Monday?", { selector: "p" })).toBeInTheDocument();
    expect(sendOutreachMessage).toHaveBeenCalledWith(ACCESS_TOKEN, "conv-1", "Can we talk Monday?");
    await waitFor(() => expect(screen.getByLabelText("Message")).toHaveValue(""));
  });

  it("shows a sending state and an inline error when sending fails", async () => {
    vi.mocked(getOutreach).mockResolvedValue(makeDetail({ status: "Replied" }));
    vi.mocked(sendOutreachMessage).mockRejectedValue(new Error("boom"));
    render(<ConversationPage />);
    fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not send your message. Try again.",
    );
    expect(screen.getByLabelText("Message")).toHaveValue("Hi");
  });

  it("re-reads the thread when the server says it is still awaiting a reply", async () => {
    vi.mocked(getOutreach)
      .mockResolvedValueOnce(makeDetail({ status: "Replied" }))
      .mockResolvedValueOnce(makeDetail({ status: "Invited" }));
    vi.mocked(sendOutreachMessage).mockRejectedValue(
      new ApiError("outreach_awaiting_reply", "x", 409),
    );
    render(<ConversationPage />);
    fireEvent.change(await screen.findByLabelText("Message"), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(screen.getAllByText("Waiting for the student to reply.").length).toBeGreaterThan(0);
  });

  it("Declined: read only with the declined line", async () => {
    vi.mocked(getOutreach).mockResolvedValue(makeDetail({ status: "Declined" }));
    render(<ConversationPage />);
    expect(
      await screen.findByText("This student declined. You cannot send more messages."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
  });

  it("shows not found and load errors", async () => {
    vi.mocked(getOutreach).mockRejectedValueOnce(new ApiError("outreach_not_found", "x", 404));
    const first = render(<ConversationPage />);
    expect(await screen.findByText("This conversation was not found")).toBeInTheDocument();
    first.unmount();
    vi.mocked(getOutreach).mockRejectedValueOnce(new Error("boom"));
    render(<ConversationPage />);
    expect(await screen.findByText("Could not load this conversation")).toBeInTheDocument();
  });

  it("does not show the student privacy line to employers", async () => {
    vi.mocked(getOutreach).mockResolvedValue(makeDetail());
    render(<ConversationPage />);
    await screen.findByText("Waiting for the student to reply.");
    expect(screen.queryByText(/cannot see your email/i)).not.toBeInTheDocument();
  });
});
