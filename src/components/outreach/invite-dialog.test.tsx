import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("@/lib/api/outreach", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/outreach")>(
    "@/lib/api/outreach",
  );
  return { ...actual, startOutreach: vi.fn() };
});

import { useSession } from "next-auth/react";
import { ApiError } from "@/lib/api/errors";
import { startOutreach } from "@/lib/api/outreach";

import { InviteDialog } from "./invite-dialog";
import { ORGANIZATION_NAME_STORAGE_KEY } from "./helpers";
import { ACCESS_TOKEN, makeDetail } from "./test-fixtures";

const onClose = vi.fn();
const onSent = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN },
    status: "authenticated",
  } as never);
});

afterEach(() => cleanup());

function open(props: Partial<React.ComponentProps<typeof InviteDialog>> = {}) {
  return render(
    <InviteDialog
      candidateId="cand-1"
      candidateName="Nadia Rahman"
      onClose={onClose}
      onSent={onSent}
      {...props}
    />,
  );
}

function fill(org: string, message: string) {
  fireEvent.change(screen.getByLabelText("Your organization"), {
    target: { value: org },
  });
  fireEvent.change(screen.getByLabelText("Message"), {
    target: { value: message },
  });
}

describe("InviteDialog", () => {
  it("renders an accessible dialog with a live character count", () => {
    open();
    const dialog = screen.getByRole("dialog", { name: "Invite Nadia Rahman" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("0 of 2000")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Hello" } });
    expect(screen.getByText("5 of 2000")).toBeInTheDocument();
  });

  it("validates both fields before calling the API", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      screen.getByText("Enter your organization, 2 to 150 characters."),
    ).toBeInTheDocument();
    expect(screen.getByText("Write a message before you send.")).toBeInTheDocument();
    expect(startOutreach).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Your organization")).toHaveFocus();
  });

  it("flags a message over 2000 characters", () => {
    open();
    fill("Acme", "a".repeat(2001));
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByText("Use 2000 characters or fewer.")).toBeInTheDocument();
    expect(startOutreach).not.toHaveBeenCalled();
  });

  it("sends, remembers the organization and reports the conversation", async () => {
    const detail = makeDetail();
    vi.mocked(startOutreach).mockResolvedValue(detail);
    open();
    fill("  Acme Analytics ", "  Hello there  ");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSent).toHaveBeenCalledWith(detail));
    expect(startOutreach).toHaveBeenCalledWith(ACCESS_TOKEN, {
      candidateId: "cand-1",
      organizationName: "Acme Analytics",
      message: "Hello there",
    });
    expect(window.localStorage.getItem(ORGANIZATION_NAME_STORAGE_KEY)).toBe(
      "Acme Analytics",
    );
  });

  it("prefills the remembered organization and focuses the message", () => {
    window.localStorage.setItem(ORGANIZATION_NAME_STORAGE_KEY, "Acme Analytics");
    open();
    expect(screen.getByLabelText("Your organization")).toHaveValue("Acme Analytics");
    expect(screen.getByLabelText("Message")).toHaveFocus();
  });

  it("still works when storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.mocked(startOutreach).mockResolvedValue(makeDetail());
    open();
    fill("Acme", "Hello");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(onSent).toHaveBeenCalled());
    vi.restoreAllMocks();
  });

  it("shows a busy state while sending", async () => {
    let resolve: (v: ReturnType<typeof makeDetail>) => void = () => {};
    vi.mocked(startOutreach).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    open();
    fill("Acme", "Hello");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("button", { name: "Sending…" })).toBeDisabled();
    resolve(makeDetail());
    await waitFor(() => expect(onSent).toHaveBeenCalled());
  });

  it.each([
    ["outreach_organization_name_invalid", "Enter your organization, 2 to 150 characters."],
    ["outreach_message_invalid", "Write a message of 1 to 2000 characters."],
    ["outreach_declined", "This student declined. You cannot send more messages."],
    ["candidate_not_found", "This student is no longer available."],
  ])("maps %s to an inline message", async (errorCode, text) => {
    vi.mocked(startOutreach).mockRejectedValue(new ApiError(errorCode, "x", 400));
    open();
    fill("Acme", "Hello");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(onSent).not.toHaveBeenCalled();
  });

  it("maps an unknown failure to a retry message", async () => {
    vi.mocked(startOutreach).mockRejectedValue(new Error("network"));
    open();
    fill("Acme", "Hello");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("Could not send the invitation. Try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("links to the known conversation on outreach_already_started", async () => {
    vi.mocked(startOutreach).mockRejectedValue(
      new ApiError("outreach_already_started", "x", 409),
    );
    open({ conversationId: "conv-7" });
    fill("Acme", "Hello");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText("You already started a conversation with this student."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the conversation" })).toHaveAttribute(
      "href",
      "/employer/messages/conv-7",
    );
  });

  it("falls back to the messages list when the id is unknown", async () => {
    vi.mocked(startOutreach).mockRejectedValue(
      new ApiError("outreach_already_started", "x", 409),
    );
    open();
    fill("Acme", "Hello");
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByRole("link", { name: "Open the conversation" }),
    ).toHaveAttribute("href", "/employer/messages");
  });

  it("closes on Escape and returns focus to the opener", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("keeps Tab focus inside the dialog", () => {
    open();
    const send = screen.getByRole("button", { name: "Send" });
    send.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    const close = screen.getByRole("button", { name: "Close" });
    close.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab", shiftKey: true });
    expect(send).toHaveFocus();
  });
});
