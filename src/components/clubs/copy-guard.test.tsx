import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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
  return {
    ...actual,
    getMyClubProfile: vi.fn(),
    listClubs: vi.fn(),
    getClub: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import { getClub, getMyClubProfile, listClubs } from "@/lib/api/clubs";
import { ApiError } from "@/lib/api/errors";

import ClubProfilePage from "@/app/(club)/club/profile/page";
import ClubLayout from "@/app/(club)/layout";
import ClubsPage from "@/app/(employer)/employer/clubs/page";
import ClubDetailPage from "@/app/(employer)/employer/clubs/[id]/page";

import { ClubNav } from "@/components/layout/header";
import { ACCESS_TOKEN, makeClubProfile, makeClubSummary } from "./test-fixtures";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Club" },
    status: "authenticated",
  } as never);
  vi.mocked(getMyClubProfile).mockResolvedValue(makeClubProfile());
  vi.mocked(listClubs).mockResolvedValue({ items: [makeClubSummary()] });
  vi.mocked(getClub).mockResolvedValue(makeClubProfile({ status: "Published" }));
});

afterEach(() => cleanup());

function assertCleanCopy(text: string) {
  expect(text.length).toBeGreaterThan(0);
  expect(text).not.toMatch(/evidence/i);
  expect(text).not.toMatch(/proof/i);
  expect(text).not.toMatch(/score/i);
  expect(text).not.toMatch(/[—–]/);
  expect(text).not.toMatch(/%/);
}

describe("club copy guard", () => {
  it("builder, filled and with errors", async () => {
    const view = render(<ClubProfilePage />);
    await screen.findByDisplayValue("Data Science Club");
    assertCleanCopy(view.container.textContent ?? "");
    fireEvent.change(screen.getByLabelText("Club name"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByText(/Enter a club name/);
    assertCleanCopy(view.container.textContent ?? "");
  });

  it("builder, empty and preview", async () => {
    vi.mocked(getMyClubProfile).mockResolvedValue(null);
    const view = render(<ClubProfilePage />);
    await screen.findByLabelText("Club name");
    assertCleanCopy(view.container.textContent ?? "");
    fireEvent.click(screen.getByRole("radio", { name: "Preview" }));
    assertCleanCopy(view.container.textContent ?? "");
  });

  it("builder load error", async () => {
    vi.mocked(getMyClubProfile).mockRejectedValue(new Error("x"));
    const view = render(<ClubProfilePage />);
    await screen.findByText("Could not load your club profile");
    assertCleanCopy(view.container.textContent ?? "");
  });

  it("company list, empty and error", async () => {
    const list = render(<ClubsPage />);
    await screen.findByRole("article");
    assertCleanCopy(list.container.textContent ?? "");
    cleanup();
    vi.mocked(listClubs).mockResolvedValue({ items: [] });
    const empty = render(<ClubsPage />);
    await screen.findByText("No clubs match.");
    assertCleanCopy(empty.container.textContent ?? "");
    cleanup();
    vi.mocked(listClubs).mockRejectedValue(new Error("x"));
    const failed = render(<ClubsPage />);
    await screen.findByText("Could not load clubs");
    assertCleanCopy(failed.container.textContent ?? "");
  });

  it("company detail and not found", async () => {
    const detail = render(<ClubDetailPage />);
    await screen.findByRole("heading", { level: 1 });
    assertCleanCopy(detail.container.textContent ?? "");
    cleanup();
    vi.mocked(getClub).mockRejectedValue(new ApiError("club_profile_not_found", "none", 404));
    const missing = render(<ClubDetailPage />);
    await screen.findByText("This club profile is not available.");
    assertCleanCopy(missing.container.textContent ?? "");
  });

  it("shell and nav", () => {
    const shell = render(
      <ClubLayout>
        <ClubNav isProfileActive />
      </ClubLayout>,
    );
    assertCleanCopy(shell.container.textContent ?? "");
  });
});
