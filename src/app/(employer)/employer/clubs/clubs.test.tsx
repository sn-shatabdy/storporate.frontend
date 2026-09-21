import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "club-1" }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api/clubs", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/clubs")>("@/lib/api/clubs");
  return { ...actual, listClubs: vi.fn(), getClub: vi.fn() };
});

import { useSession } from "next-auth/react";
import { getClub, listClubs } from "@/lib/api/clubs";
import { ApiError } from "@/lib/api/errors";
import {
  ACCESS_TOKEN,
  makeClubProfile,
  makeClubSummary,
} from "@/components/clubs/test-fixtures";

import ClubsPage from "./page";
import ClubDetailPage from "./[id]/page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Organization" },
    status: "authenticated",
  } as never);
  vi.mocked(listClubs).mockResolvedValue({ items: [makeClubSummary()] });
});

afterEach(() => cleanup());

describe("employer clubs list", () => {
  it("shows skeletons while loading", () => {
    vi.mocked(listClubs).mockReturnValue(new Promise(() => {}));
    render(<ClubsPage />);
    expect(screen.getByText("Loading clubs.")).toBeInTheDocument();
  });

  it("renders a card with the summary details and a link to the profile", async () => {
    vi.mocked(listClubs).mockResolvedValue({
      items: [
        makeClubSummary({
          fieldsOfStudy: ["A1", "B2", "C3", "D4", "E5"],
          memberCount: 1,
          eventCount: 1,
        }),
      ],
    });
    render(<ClubsPage />);
    const card = await screen.findByRole("article");
    expect(card).toHaveTextContent("Data Science Club");
    expect(card).toHaveTextContent("Learn by building");
    expect(card).toHaveTextContent("BUET · 1 member");
    expect(card).toHaveTextContent("A1");
    expect(card).toHaveTextContent("C3");
    expect(card).not.toHaveTextContent("D4");
    expect(card).toHaveTextContent("+2 more");
    expect(card).toHaveTextContent("1 event");
    expect(screen.getByRole("link")).toHaveAttribute("href", "/employer/clubs/club-1");
    expect(listClubs).toHaveBeenCalledWith(ACCESS_TOKEN, {}, expect.anything());
  });

  it("pluralises members and events", async () => {
    render(<ClubsPage />);
    const card = await screen.findByRole("article");
    expect(card).toHaveTextContent("120 members");
    expect(card).toHaveTextContent("3 events");
  });

  it("debounces the filters and passes them to the API", async () => {
    render(<ClubsPage />);
    await screen.findByRole("article");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "dat" } });
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "data" } });
    fireEvent.change(screen.getByLabelText("Field of study"), { target: { value: "Statistics" } });
    fireEvent.change(screen.getByLabelText("University"), { target: { value: "BUET" } });
    expect(listClubs).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(listClubs).toHaveBeenCalledTimes(2));
    expect(vi.mocked(listClubs).mock.calls[1][1]).toEqual({
      q: "data",
      field: "Statistics",
      university: "BUET",
    });
  });

  it("shows the empty state and clears filters", async () => {
    vi.mocked(listClubs).mockResolvedValue({ items: [] });
    render(<ClubsPage />);
    expect(await screen.findByText("No clubs match.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("University"), { target: { value: "BUET" } });
    const clear = await screen.findByRole("button", { name: "Clear filters" });
    fireEvent.click(clear);
    expect(screen.getByLabelText("University")).toHaveValue("");
  });

  it("shows an error state with retry", async () => {
    vi.mocked(listClubs).mockRejectedValueOnce(new Error("x"));
    render(<ClubsPage />);
    expect(await screen.findByText("Could not load clubs")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("article")).toBeInTheDocument();
  });
});

describe("employer club detail", () => {
  it("shows the club profile with a back link", async () => {
    vi.mocked(getClub).mockResolvedValue(makeClubProfile({ status: "Published" }));
    render(<ClubDetailPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Data Science Club" })).toBeInTheDocument();
    expect(getClub).toHaveBeenCalledWith(ACCESS_TOKEN, "club-1", expect.anything());
    expect(screen.getByRole("link", { name: /Clubs/ })).toHaveAttribute("href", "/employer/clubs");
    expect(screen.getByText("Data Night")).toBeInTheDocument();
  });

  it("shows the not available state on 404", async () => {
    vi.mocked(getClub).mockRejectedValue(new ApiError("club_profile_not_found", "none", 404));
    render(<ClubDetailPage />);
    expect(await screen.findByText("This club profile is not available.")).toBeInTheDocument();
  });

  it("shows a retryable error on other failures", async () => {
    vi.mocked(getClub).mockRejectedValueOnce(new Error("x"));
    vi.mocked(getClub).mockResolvedValue(makeClubProfile());
    render(<ClubDetailPage />);
    expect(await screen.findByText("Could not load this club")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
  });
});
