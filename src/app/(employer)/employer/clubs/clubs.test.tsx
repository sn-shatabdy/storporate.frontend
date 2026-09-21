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
  vi.mocked(listClubs).mockResolvedValue({
    items: [makeClubSummary()],
    total: 1,
  });
});

afterEach(() => cleanup());

describe("employer clubs list", () => {
  it("shows skeletons while loading", () => {
    vi.mocked(listClubs).mockReturnValue(new Promise(() => {}));
    render(<ClubsPage />);
    expect(screen.getByText("Loading clubs.")).toBeInTheDocument();
  });

  it("renders a card with the enriched summary and a link to the profile", async () => {
    vi.mocked(listClubs).mockResolvedValue({
      items: [
        makeClubSummary({
          name: "Robotics Society",
          tagline: "Building robots, building futures",
          university: "University of Dhaka",
          memberCount: 84,
          foundedYear: 2016,
          audienceYears: [2, 3, 4],
          eventAttendanceSummary: { min: 40, max: 180 },
          supportNeeds: ["Venue", "Prizes", "Volunteers"],
        }),
      ],
      total: 1,
    });
    render(<ClubsPage />);
    const card = await screen.findByRole("article");
    expect(card).toHaveTextContent("Robotics Society");
    expect(card).toHaveTextContent("Building robots, building futures");
    expect(card).toHaveTextContent("University of Dhaka");
    expect(card).toHaveTextContent("84 members");
    expect(card).toHaveTextContent("Founded 2016");
    expect(card).toHaveTextContent("Years 2-4");
    expect(card).toHaveTextContent("Attendance 40-180");
    expect(card).toHaveTextContent("Needs: Venue, Prizes, Volunteers");
    expect(screen.getByRole("link", { name: /View profile of Robotics Society/ })).toHaveAttribute(
      "href",
      "/employer/clubs/club-1",
    );
    expect(listClubs).toHaveBeenCalledWith(
      ACCESS_TOKEN,
      { q: "", field: "", university: "" },
      expect.anything(),
    );
  });

  it("shows the singular members copy", async () => {
    vi.mocked(listClubs).mockResolvedValue({
      items: [makeClubSummary({ memberCount: 1 })],
      total: 1,
    });
    render(<ClubsPage />);
    const card = await screen.findByRole("article");
    expect(card).toHaveTextContent("1 member");
  });

  it("omits founded year, audience years, attendance and support needs when they are absent", async () => {
    vi.mocked(listClubs).mockResolvedValue({
      items: [
        makeClubSummary({
          foundedYear: null,
          audienceYears: [],
          eventAttendanceSummary: { min: null, max: null },
          supportNeeds: [],
        }),
      ],
      total: 1,
    });
    render(<ClubsPage />);
    const card = await screen.findByRole("article");
    expect(card).not.toHaveTextContent("Founded");
    expect(card).not.toHaveTextContent(/Years\s/);
    expect(card).not.toHaveTextContent(/Attendance\s/);
    expect(card).not.toHaveTextContent("Needs:");
  });

  it("renders attendance as a single value when min equals max", async () => {
    vi.mocked(listClubs).mockResolvedValue({
      items: [makeClubSummary({ eventAttendanceSummary: { min: 80, max: 80 } })],
      total: 1,
    });
    render(<ClubsPage />);
    const card = await screen.findByRole("article");
    expect(card).toHaveTextContent("Attendance 80");
    expect(card).not.toHaveTextContent("Attendance 80-80");
  });

  it("shows the 'showing N of total' affordance when the result was truncated", async () => {
    vi.mocked(listClubs).mockResolvedValue({
      items: Array.from({ length: 50 }, (_, i) =>
        makeClubSummary({ id: `c${i}`, name: `Club ${i}` }),
      ),
      total: 63,
    });
    render(<ClubsPage />);
    const count = await screen.findByTestId("clubs-count");
    expect(count).toHaveTextContent("Showing 50 of 63 clubs.");
  });

  it("hides the 'of total' clause when nothing was truncated", async () => {
    vi.mocked(listClubs).mockResolvedValue({
      items: [makeClubSummary({ name: "Only Club" })],
      total: 1,
    });
    render(<ClubsPage />);
    const count = await screen.findByTestId("clubs-count");
    expect(count).toHaveTextContent("Showing 1 club.");
    expect(count).not.toHaveTextContent("of");
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
    vi.mocked(listClubs).mockResolvedValue({ items: [], total: 0 });
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
  it("shows the club profile with a back link and the Key facts panel", async () => {
    vi.mocked(getClub).mockResolvedValue(makeClubProfile({ status: "Published" }));
    render(<ClubDetailPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Data Science Club" })).toBeInTheDocument();
    expect(getClub).toHaveBeenCalledWith(ACCESS_TOKEN, "club-1", expect.anything());
    expect(screen.getByRole("link", { name: /Clubs/ })).toHaveAttribute("href", "/employer/clubs");
    expect(screen.getByText("Data Night")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Key facts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send a sponsorship request" })).toBeInTheDocument();
  });

  it("renders founded and attendance range inside the right-rail Key facts panel", async () => {
    vi.mocked(getClub).mockResolvedValue(
      makeClubProfile({
        status: "Published",
        events: [
          { id: "a", title: "Hackathon", description: null, typicalAttendance: 40, frequency: "Yearly", supportNeeds: [] },
          { id: "b", title: "Demo day", description: null, typicalAttendance: 180, frequency: "Termly", supportNeeds: [] },
        ],
      }),
    );
    render(<ClubDetailPage />);
    const panel = (await screen.findByRole("heading", { name: "Key facts" })).closest("section") as HTMLElement;
    // jSDOM concatenates dt/dd text without whitespace, so query each row's
    // value cell directly rather than reading textContent.
    const rows = panel.querySelectorAll("dl > div");
    expect(rows).toHaveLength(3);
    expect(rows[1].querySelector("dd")).toHaveTextContent("2018");
    expect(rows[2].querySelector("dd")).toHaveTextContent("40-180");
  });

  it("shows 'Not listed yet' for Founded and Attendance range when absent", async () => {
    vi.mocked(getClub).mockResolvedValue(
      makeClubProfile({
        status: "Published",
        foundedYear: null,
        events: [],
      }),
    );
    render(<ClubDetailPage />);
    const panel = (await screen.findByRole("heading", { name: "Key facts" })).closest("section") as HTMLElement;
    const rows = panel.querySelectorAll("dl > div");
    expect(rows[1].querySelector("dd")).toHaveTextContent("Not listed yet.");
    expect(rows[2].querySelector("dd")).toHaveTextContent("Not listed yet.");
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
