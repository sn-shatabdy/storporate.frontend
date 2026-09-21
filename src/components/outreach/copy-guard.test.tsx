import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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
    listShortlist: vi.fn(),
    listMyOutreach: vi.fn(),
    getOutreach: vi.fn(),
    listInbox: vi.fn(),
    getInboxConversation: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import {
  getInboxConversation,
  getOutreach,
  listInbox,
  listMyOutreach,
  listShortlist,
} from "@/lib/api/outreach";

import ShortlistPage from "@/app/(employer)/employer/shortlist/page";
import EmployerMessagesPage from "@/app/(employer)/employer/messages/page";
import EmployerConversationPage from "@/app/(employer)/employer/messages/[id]/page";
import InboxPage from "@/app/dashboard/inbox/page";
import InboxConversationPage from "@/app/dashboard/inbox/[id]/page";

import { InviteDialog } from "./invite-dialog";
import {
  ACCESS_TOKEN,
  makeDetail,
  makeEntry,
  makeSummary,
} from "./test-fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN },
    status: "authenticated",
  } as never);
  vi.mocked(useParams).mockReturnValue({ id: "conv-1" } as never);
  vi.mocked(listShortlist).mockResolvedValue({
    items: [
      makeEntry(),
      makeEntry({
        candidateId: "gone",
        available: false,
        displayName: null,
        headline: null,
        university: null,
        fieldOfStudy: null,
        studyYear: null,
      }),
    ],
  });
  vi.mocked(listMyOutreach).mockResolvedValue({ items: [makeSummary()] });
  vi.mocked(listInbox).mockResolvedValue({ items: [makeSummary()] });
  vi.mocked(getOutreach).mockResolvedValue(makeDetail({ status: "Invited" }));
  vi.mocked(getInboxConversation).mockResolvedValue(
    makeDetail({ counterpartName: "Acme Analytics" }),
  );
});

afterEach(() => cleanup());

function assertCleanCopy(text: string) {
  expect(text).not.toMatch(/evidence/i);
  expect(text).not.toMatch(/proof/i);
  expect(text).not.toMatch(/score/i);
  expect(text).not.toMatch(/[—–]/);
  expect(text).not.toMatch(/%/);
}

describe("outreach copy guard", () => {
  it.each([
    ["shortlist", ShortlistPage, "Nadia Rahman"],
    ["employer messages", EmployerMessagesPage, "Nadia Rahman"],
    ["employer thread", EmployerConversationPage, "Waiting for the student to reply."],
    ["student inbox", InboxPage, "Nadia Rahman"],
    ["student thread", InboxConversationPage, "Decline"],
  ])("%s", async (_name, Page, ready) => {
    const { container } = render(<Page />);
    await screen.findAllByText(ready);
    assertCleanCopy(container.textContent ?? "");
  });

  it("invite dialog, including validation errors", () => {
    render(<InviteDialog candidateId="c" candidateName="Nadia Rahman" onClose={() => {}} onSent={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    assertCleanCopy(document.body.textContent ?? "");
  });

  it("empty states", async () => {
    vi.mocked(listShortlist).mockResolvedValue({ items: [] });
    const a = render(<ShortlistPage />);
    await screen.findByText("No one saved yet.");
    assertCleanCopy(a.container.textContent ?? "");
    a.unmount();
    vi.mocked(listInbox).mockResolvedValue({ items: [] });
    const b = render(<InboxPage />);
    await screen.findByText("No messages yet.");
    assertCleanCopy(b.container.textContent ?? "");
  });
});
