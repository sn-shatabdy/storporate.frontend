import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/club/profile",
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
  return {
    ...actual,
    getMyClubProfile: vi.fn(),
    saveClubProfile: vi.fn(),
    publishClubProfile: vi.fn(),
    unpublishClubProfile: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import {
  getMyClubProfile,
  publishClubProfile,
  saveClubProfile,
  unpublishClubProfile,
} from "@/lib/api/clubs";
import { ApiError } from "@/lib/api/errors";
import { ACCESS_TOKEN, makeClubProfile } from "@/components/clubs/test-fixtures";

import ClubProfilePage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Club" },
    status: "authenticated",
  } as never);
  vi.mocked(getMyClubProfile).mockResolvedValue(null);
});

afterEach(() => cleanup());

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function renderEmpty() {
  render(<ClubProfilePage />);
  await screen.findByLabelText("Club name");
}

function fillRequired() {
  type("Club name", "Data Science Club");
  type("About", "We run weekly data sessions for students.");
  type("University", "BUET");
  type("Member count", "120");
  const fields = screen.getByLabelText("Fields of study");
  fireEvent.change(fields, { target: { value: "Statistics" } });
  fireEvent.keyDown(fields, { key: "Enter" });
  fireEvent.click(screen.getByRole("button", { name: "Year 1" }));
}

describe("club profile builder", () => {
  it("shows an empty builder for a new club", async () => {
    await renderEmpty();
    expect(screen.getByLabelText("Club name")).toHaveValue("");
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(
      screen.getByText("Add the events you run. Companies use this to see where they could help."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText("What is missing to publish")).toBeInTheDocument();
    expect(screen.getByText("Fill in the missing items to publish.")).toBeInTheDocument();
    expect(getMyClubProfile).toHaveBeenCalledWith(ACCESS_TOKEN, expect.anything());
  });

  it("loads an existing profile into the form", async () => {
    vi.mocked(getMyClubProfile).mockResolvedValue(makeClubProfile());
    render(<ClubProfilePage />);
    expect(await screen.findByDisplayValue("Data Science Club")).toBeInTheDocument();
    expect(screen.getByLabelText("Tagline")).toHaveValue("Learn by building");
    expect(screen.getByLabelText("Member count")).toHaveValue(120);
    expect(screen.getByLabelText("Founded year")).toHaveValue(2018);
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Year 2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Year 4" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByDisplayValue("Data Night")).toBeInTheDocument();
    expect(screen.getByLabelText("How often")).toHaveValue("Monthly");
    expect(screen.getByText("Everything needed to publish is filled in.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("shows an error state with retry when loading fails", async () => {
    vi.mocked(getMyClubProfile).mockRejectedValueOnce(new Error("x"));
    render(<ClubProfilePage />);
    expect(await screen.findByText("Could not load your club profile")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByLabelText("Club name")).toBeInTheDocument();
  });

  it("validates on save, shows inline errors and focuses the first invalid field", async () => {
    await renderEmpty();
    type("Club name", "X");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Enter a club name of 2 to 150/)).toBeInTheDocument();
    expect(screen.getByText(/Describe your club in 20 to 3000/)).toBeInTheDocument();
    expect(screen.getByText(/Enter a university of 2 to 150/)).toBeInTheDocument();
    expect(screen.getByText(/Enter the number of members/)).toBeInTheDocument();
    expect(saveClubProfile).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText("Club name")).toHaveFocus());
    expect(screen.getByLabelText("Club name")).toHaveAttribute("aria-invalid", "true");
  });

  it("validates event fields", async () => {
    await renderEmpty();
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Enter a title of 3 to 120/)).toBeInTheDocument();
    expect(screen.getByText(/Enter a number from 1 to 100,000/)).toBeInTheDocument();
    expect(saveClubProfile).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText("Event title")).toHaveFocus());
  });

  it("adds and removes events and caps them at 12", async () => {
    await renderEmpty();
    const add = screen.getByRole("button", { name: "Add event" });
    fireEvent.click(add);
    fireEvent.click(add);
    expect(screen.getAllByRole("group", { name: /^Event \d+$/ })).toHaveLength(2);
    expect(
      screen.queryByText("Add the events you run. Companies use this to see where they could help."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove event 1" }));
    expect(screen.getAllByRole("group", { name: /^Event \d+$/ })).toHaveLength(1);
    for (let i = 0; i < 11; i++) fireEvent.click(add);
    expect(screen.getAllByRole("group", { name: /^Event \d+$/ })).toHaveLength(12);
    expect(add).toBeDisabled();
    expect(screen.getByText("You can list up to 12 events.")).toBeInTheDocument();
  });

  it("toggles support needs and study years", async () => {
    await renderEmpty();
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    const group = screen.getByRole("group", { name: "Support needed" });
    const venue = within(group).getByRole("button", { name: "Venue" });
    fireEvent.click(venue);
    expect(venue).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(venue);
    expect(venue).toHaveAttribute("aria-pressed", "false");
  });

  it("sends the right body on save and shows Saved.", async () => {
    vi.mocked(getMyClubProfile).mockResolvedValue(makeClubProfile());
    const saved = makeClubProfile({ name: "Data Club" });
    vi.mocked(saveClubProfile).mockResolvedValue(saved);
    render(<ClubProfilePage />);
    await screen.findByDisplayValue("Data Science Club");
    type("Club name", "  Data Club ");
    type("Tagline", "");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
    expect(saveClubProfile).toHaveBeenCalledTimes(1);
    expect(saveClubProfile).toHaveBeenCalledWith(ACCESS_TOKEN, {
      name: "Data Club",
      tagline: null,
      about: "We run weekly data sessions and a yearly hackathon for students.",
      university: "BUET",
      city: "Dhaka",
      foundedYear: 2018,
      memberCount: 120,
      audience: { fieldsOfStudy: ["Computer Science", "Statistics"], years: [1, 2, 3] },
      events: [
        {
          id: "ev-1",
          title: "Data Night",
          description: "A monthly evening of talks and demos.",
          typicalAttendance: 80,
          frequency: "Monthly",
          supportNeeds: ["Venue", "Food and drink"],
        },
      ],
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("keeps Publish disabled until every item is filled in", async () => {
    await renderEmpty();
    const publish = screen.getByRole("button", { name: "Publish" });
    expect(publish).toBeDisabled();
    type("Club name", "Data Science Club");
    type("About", "We run weekly data sessions for students.");
    type("University", "BUET");
    type("Member count", "120");
    expect(publish).toBeDisabled();
    const fields = screen.getByLabelText("Fields of study");
    fireEvent.change(fields, { target: { value: "Statistics" } });
    fireEvent.keyDown(fields, { key: "Enter" });
    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Year 1" }));
    expect(publish).toBeEnabled();
    expect(screen.getByText("Everything needed to publish is filled in.")).toBeInTheDocument();
  });

  it("saves first when dirty, then publishes", async () => {
    vi.mocked(getMyClubProfile).mockResolvedValue(makeClubProfile());
    vi.mocked(saveClubProfile).mockResolvedValue(makeClubProfile({ name: "Data Club" }));
    vi.mocked(publishClubProfile).mockResolvedValue(
      makeClubProfile({ name: "Data Club", status: "Published", publishedAt: "2026-09-21T10:00:00Z" }),
    );
    render(<ClubProfilePage />);
    await screen.findByDisplayValue("Data Science Club");
    type("Club name", "Data Club");
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Your profile is published.")).toBeInTheDocument();
    expect(saveClubProfile).toHaveBeenCalledTimes(1);
    expect(publishClubProfile).toHaveBeenCalledWith(ACCESS_TOKEN);
    expect(vi.mocked(saveClubProfile).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(publishClubProfile).mock.invocationCallOrder[0],
    );
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument();
  });

  it("publishes without saving when nothing changed", async () => {
    vi.mocked(getMyClubProfile).mockResolvedValue(makeClubProfile());
    vi.mocked(publishClubProfile).mockResolvedValue(makeClubProfile({ status: "Published" }));
    render(<ClubProfilePage />);
    await screen.findByDisplayValue("Data Science Club");
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    await screen.findByText("Your profile is published.");
    expect(saveClubProfile).not.toHaveBeenCalled();
  });

  it("does not publish when the save fails", async () => {
    vi.mocked(getMyClubProfile).mockResolvedValue(makeClubProfile());
    vi.mocked(saveClubProfile).mockRejectedValue(
      new ApiError("club_profile_invalid", "The about text is too long.", 400),
    );
    render(<ClubProfilePage />);
    await screen.findByDisplayValue("Data Science Club");
    type("Club name", "Data Club");
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The about text is too long.");
    expect(publishClubProfile).not.toHaveBeenCalled();
  });

  it("unpublishes a published profile", async () => {
    vi.mocked(getMyClubProfile).mockResolvedValue(makeClubProfile({ status: "Published" }));
    vi.mocked(unpublishClubProfile).mockResolvedValue(makeClubProfile({ status: "Draft" }));
    render(<ClubProfilePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Unpublish" }));
    expect(await screen.findByText("Your profile is unpublished.")).toBeInTheDocument();
    expect(unpublishClubProfile).toHaveBeenCalledWith(ACCESS_TOKEN);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("maps a server message and a network failure", async () => {
    vi.mocked(getMyClubProfile).mockResolvedValue(makeClubProfile());
    vi.mocked(saveClubProfile)
      .mockRejectedValueOnce(new ApiError("club_profile_invalid", "That year is not allowed.", 400))
      .mockRejectedValueOnce(new Error("offline"));
    render(<ClubProfilePage />);
    await screen.findByDisplayValue("Data Science Club");
    type("Club name", "Data Club");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That year is not allowed.");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/Could not save your profile/),
    );
    // Values stay in the form after a failed save.
    expect(screen.getByLabelText("Club name")).toHaveValue("Data Club");
  });

  it("shows the server message when publish is refused as incomplete", async () => {
    vi.mocked(getMyClubProfile).mockResolvedValue(makeClubProfile());
    vi.mocked(publishClubProfile).mockRejectedValue(
      new ApiError("club_profile_incomplete", "Add a study year before publishing.", 400),
    );
    render(<ClubProfilePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Add a study year before publishing.");
  });

  it("toggles between Edit and Preview using the live form values", async () => {
    await renderEmpty();
    type("Club name", "Robotics Society");
    fireEvent.click(screen.getByRole("radio", { name: "Preview" }));
    expect(screen.queryByLabelText("Club name")).not.toBeInTheDocument();
    expect(screen.getByText("This is how companies see your profile.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Robotics Society" })).toBeInTheDocument();
    expect(screen.getByText("No events listed yet.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Edit" }));
    expect(screen.getByLabelText("Club name")).toHaveValue("Robotics Society");
  });
});
