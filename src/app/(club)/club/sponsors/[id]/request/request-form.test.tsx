import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const pushMock = vi.fn();

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useParams: () => ({ id: "goal-1" }),
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
  return { ...actual, createRequest: vi.fn() };
});

import { useSession } from "next-auth/react";
import { getCompanyGoal } from "@/lib/api/sponsorship";
import { createRequest } from "@/lib/api/sponsorshipRequests";
import { ApiError } from "@/lib/api/errors";
import { makeDetail } from "@/components/sponsorship/test-fixtures";
import { ACCESS_TOKEN, makeRequestDetail } from "@/components/requests/test-fixtures";

import RequestSponsorshipPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  pushMock.mockReset();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Club" },
    status: "authenticated",
  } as never);
  vi.mocked(getCompanyGoal).mockResolvedValue(makeDetail());
  vi.mocked(createRequest).mockResolvedValue(makeRequestDetail({ id: "new-req" }));
});

afterEach(() => cleanup());

function change(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillValid() {
  change("Event title", "Dhaka Hack Night");
  change("About the event", "A twelve hour hackathon for two hundred students.");
  change("What you are asking for", "Cash support for prizes.");
  change("What the company gets in return", "Logo on all banners.");
}

async function openForm() {
  render(<RequestSponsorshipPage />);
  await screen.findByRole("button", { name: "Send request" });
}

describe("request form", () => {
  it("shows a skeleton then the company context and the form", async () => {
    render(<RequestSponsorshipPage />);
    expect(screen.getByText("Loading the goal set.")).toBeInTheDocument();
    await screen.findByRole("button", { name: "Send request" });
    expect(getCompanyGoal).toHaveBeenCalledWith(ACCESS_TOKEN, "goal-1", expect.anything());
    const context = screen.getByRole("region", { name: "Who you are asking" });
    expect(context).toHaveTextContent("Acme Ltd");
    expect(context).toHaveTextContent("Campus hiring");
    expect(context).toHaveTextContent("Recruiting");
    expect(context).toHaveTextContent("Hackathon");
    for (const label of [
      "Event title",
      "Event date (optional)",
      "About the event",
      "What you are asking for",
      "What the company gets in return",
      "Amount you are asking for (BDT) (optional)",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it("shows per-field errors and focuses the first invalid field", async () => {
    await openForm();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getByText(/The event title needs 2 to 150 characters/)).toBeInTheDocument();
    expect(screen.getByText(/The event description needs 20 to 3,000 characters/)).toBeInTheDocument();
    expect(screen.getByText(/What you are asking for needs 10 to 1,500/)).toBeInTheDocument();
    expect(screen.getByText(/What the company gets in return needs 10 to 1,500/)).toBeInTheDocument();
    expect(screen.getByLabelText("Event title")).toHaveFocus();
    expect(screen.getByLabelText("Event title")).toHaveAttribute("aria-invalid", "true");
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("rejects a bad amount and a past date", async () => {
    await openForm();
    fillValid();
    change("Amount you are asking for (BDT) (optional)", "12.5");
    change("Event date (optional)", "2020-01-01");
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getByText(/Enter a whole amount from 0 to 1,000,000,000/)).toBeInTheDocument();
    expect(screen.getByText("Pick a date that is not in the past.")).toBeInTheDocument();
    expect(screen.getByLabelText("Event date (optional)")).toHaveFocus();
    expect(createRequest).not.toHaveBeenCalled();
  });

  it("shows character counters", async () => {
    await openForm();
    change("What you are asking for", "Cash");
    expect(screen.getByText("4 of 1,500")).toBeInTheDocument();
    expect(screen.getByText("0 of 3,000")).toBeInTheDocument();
  });

  it("sends the payload and goes to the new request", async () => {
    await openForm();
    fillValid();
    change("Event date (optional)", "2099-01-05");
    change("Amount you are asking for (BDT) (optional)", "50000");
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/club/requests/new-req"));
    expect(createRequest).toHaveBeenCalledWith(ACCESS_TOKEN, {
      goalId: "goal-1",
      eventTitle: "Dhaka Hack Night",
      eventDate: "2099-01-05",
      eventDescription: "A twelve hour hackathon for two hundred students.",
      ask: "Cash support for prizes.",
      amountRequested: 50000,
      offer: "Logo on all banners.",
    });
    expect(screen.getByText("Request sent.")).toBeInTheDocument();
  });

  it("sends null for a blank date and amount", async () => {
    await openForm();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(createRequest).toHaveBeenCalled());
    const input = vi.mocked(createRequest).mock.calls[0][1];
    expect(input.eventDate).toBeNull();
    expect(input.amountRequested).toBeNull();
  });

  it("links to the sent requests on a duplicate", async () => {
    vi.mocked(createRequest).mockRejectedValue(
      new ApiError("sponsorship_request_duplicate", "x", 409),
    );
    await openForm();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You already have an open request");
    expect(screen.getByRole("link", { name: "See your sent requests" })).toHaveAttribute(
      "href",
      "/club/requests",
    );
    expect(pushMock).not.toHaveBeenCalled();
    // The form keeps what was typed and can be sent again.
    expect(screen.getByLabelText("Event title")).toHaveValue("Dhaka Hack Night");
    expect(screen.getByRole("button", { name: "Send request" })).toBeEnabled();
  });

  it.each([
    ["club_profile_not_published", "Publish your club profile"],
    ["club_profile_not_found", "Create your club profile"],
  ])("points to the club profile on %s", async (code, text) => {
    vi.mocked(createRequest).mockRejectedValue(new ApiError(code, "x", 409));
    await openForm();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(text);
    expect(screen.getByRole("link", { name: "Go to my club profile" })).toHaveAttribute(
      "href",
      "/club/profile",
    );
  });

  it("shows the goal not found state when the goal vanishes on submit", async () => {
    vi.mocked(createRequest).mockRejectedValue(
      new ApiError("sponsorship_goal_not_found", "x", 404),
    );
    await openForm();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await screen.findByText("This goal set is not available.");
    expect(screen.queryByRole("button", { name: "Send request" })).not.toBeInTheDocument();
  });

  it("shows the server message for another request error", async () => {
    vi.mocked(createRequest).mockRejectedValue(
      new ApiError("sponsorship_request_event_date_invalid", "The event date is too far away.", 400),
    );
    await openForm();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The event date is too far away.");
  });

  it("shows a generic message for a network failure", async () => {
    vi.mocked(createRequest).mockRejectedValue(new Error("offline"));
    await openForm();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not send the request");
  });

  it("shows not found when the goal set is missing on load", async () => {
    vi.mocked(getCompanyGoal).mockRejectedValue(
      new ApiError("sponsorship_goal_not_found", "x", 404),
    );
    render(<RequestSponsorshipPage />);
    await screen.findByText("This goal set is not available.");
    expect(screen.getByRole("link", { name: "Back to sponsors" })).toHaveAttribute(
      "href",
      "/club/sponsors",
    );
  });

  it("shows an error with retry when the load fails", async () => {
    vi.mocked(getCompanyGoal).mockRejectedValueOnce(new Error("x"));
    render(<RequestSponsorshipPage />);
    await screen.findByText("Could not load this goal set");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("button", { name: "Send request" });
  });
});
