import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/lib/api/outreach", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/outreach")>(
    "@/lib/api/outreach",
  );
  return {
    ...actual,
    listShortlist: vi.fn(),
    removeFromShortlist: vi.fn(),
    startOutreach: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import { listShortlist, removeFromShortlist, startOutreach } from "@/lib/api/outreach";
import {
  ACCESS_TOKEN,
  makeDetail,
  makeEntry,
} from "@/components/outreach/test-fixtures";

import ShortlistPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN },
    status: "authenticated",
  } as never);
});

afterEach(() => cleanup());

describe("ShortlistPage", () => {
  it("shows skeletons while loading", () => {
    vi.mocked(listShortlist).mockReturnValue(new Promise(() => {}));
    render(<ShortlistPage />);
    expect(screen.getByRole("heading", { name: "Your shortlist" })).toBeInTheDocument();
    expect(screen.getByText("Loading your shortlist.")).toBeInTheDocument();
  });

  it("shows the empty state with a link to Search", async () => {
    vi.mocked(listShortlist).mockResolvedValue({ items: [] });
    render(<ShortlistPage />);
    expect(await screen.findByText("No one saved yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute(
      "href",
      "/employer/search",
    );
  });

  it("shows an error and retries", async () => {
    vi.mocked(listShortlist).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(listShortlist).mockResolvedValueOnce({ items: [makeEntry()] });
    render(<ShortlistPage />);
    expect(await screen.findByText("Could not load your shortlist")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Nadia Rahman")).toBeInTheDocument();
    expect(listShortlist).toHaveBeenCalledTimes(2);
  });

  it("renders saved students with details, links and actions", async () => {
    vi.mocked(listShortlist).mockResolvedValue({
      items: [
        makeEntry(),
        makeEntry({
          candidateId: "cand-2",
          displayName: "Arif Hasan",
          conversation: { id: "conv-2", status: "Replied" },
        }),
      ],
    });
    render(<ShortlistPage />);
    expect(await screen.findByText("Nadia Rahman")).toBeInTheDocument();
    expect(screen.getAllByText("Data student who builds dashboards")).toHaveLength(2);
    expect(screen.getAllByText(/BUET · Computer Science · Year 3 · Saved/)).toHaveLength(2);
    const links = screen.getAllByRole("link", { name: /View portfolio/ });
    expect(links[0]).toHaveAttribute("href", "/employer/candidates/cand-1");
    expect(screen.getAllByRole("button", { name: "Invite" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Open conversation" })).toHaveAttribute(
      "href",
      "/employer/messages/conv-2",
    );
    expect(screen.getByText("Replied")).toBeInTheDocument();
    expect(screen.getByText("2 students")).toBeInTheDocument();
  });

  it("shows a muted card with only Remove for an unavailable student", async () => {
    vi.mocked(listShortlist).mockResolvedValue({
      items: [
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
    render(<ShortlistPage />);
    expect(
      await screen.findByText("This student is no longer available."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View portfolio/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invite" })).not.toBeInTheDocument();
  });

  it("removes an entry", async () => {
    vi.mocked(listShortlist).mockResolvedValue({ items: [makeEntry()] });
    vi.mocked(removeFromShortlist).mockResolvedValue(undefined);
    render(<ShortlistPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    await waitFor(() => expect(screen.getByText("No one saved yet.")).toBeInTheDocument());
    expect(removeFromShortlist).toHaveBeenCalledWith(ACCESS_TOKEN, "cand-1");
  });

  it("keeps the entry and shows an error when remove fails", async () => {
    vi.mocked(listShortlist).mockResolvedValue({ items: [makeEntry()] });
    vi.mocked(removeFromShortlist).mockRejectedValue(new Error("boom"));
    render(<ShortlistPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not remove this student. Try again.",
    );
    expect(screen.getByText("Nadia Rahman")).toBeInTheDocument();
  });

  it("invites from the card and switches to Open conversation with an Invited pill", async () => {
    vi.mocked(listShortlist).mockResolvedValue({ items: [makeEntry()] });
    vi.mocked(startOutreach).mockResolvedValue(makeDetail({ id: "conv-5" }));
    render(<ShortlistPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Invite" }));
    fireEvent.change(screen.getByLabelText("Your organization"), {
      target: { value: "Acme" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Hello" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const link = await screen.findByRole("link", { name: "Open conversation" });
    expect(link).toHaveAttribute("href", "/employer/messages/conv-5");
    expect(screen.getByText("Invited")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
