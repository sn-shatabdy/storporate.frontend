import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/api/matching", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/matching")>("@/lib/api/matching");
  return { ...actual, listCompanyMatches: vi.fn() };
});

import { useSession } from "next-auth/react";
import { listCompanyMatches } from "@/lib/api/matching";
import { ApiError } from "@/lib/api/errors";
import { makeSummary } from "@/components/sponsorship/test-fixtures";
import { ACCESS_TOKEN, makeCompanyMatch } from "@/components/matching/test-fixtures";

import ClubMatchesPage from "./page";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Club" },
    status: "authenticated",
  } as never);
  vi.mocked(listCompanyMatches).mockResolvedValue({
    items: [
      makeCompanyMatch(),
      makeCompanyMatch({
        fit: "Partial",
        company: makeSummary({ id: "goal-2", companyName: "Beta Co", name: "Events", budget: null }),
      }),
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("club matches page", () => {
  it("shows the heading, a skeleton, then company cards", async () => {
    render(<ClubMatchesPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Companies that fit your club" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Loading companies.")).toBeInTheDocument();
    expect(await screen.findAllByRole("article")).toHaveLength(2);
    expect(listCompanyMatches).toHaveBeenCalledWith(ACCESS_TOKEN, "", expect.anything());
  });

  it("shows band, reasons, chips, budget and the goals link", async () => {
    render(<ClubMatchesPage />);
    const [first, second] = await screen.findAllByRole("article");
    expect(within(first).getByRole("heading", { name: "Acme Ltd" })).toBeInTheDocument();
    expect(within(first).getByText("Campus hiring")).toBeInTheDocument();
    expect(within(first).getByText("Good fit")).toBeInTheDocument();
    expect(within(first).getByText("Backs career fairs.")).toBeInTheDocument();
    expect(within(first).getByText("Recruiting")).toBeInTheDocument();
    expect(within(first).getByText("Hackathon")).toBeInTheDocument();
    expect(within(first).getByText("BDT 50,000 to BDT 200,000")).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: /View goals/ })).toHaveAttribute(
      "href",
      "/club/sponsors/goal-1",
    );
    expect(within(first).getByRole("link", { name: /Request sponsorship from Acme Ltd/ })).toHaveAttribute(
      "href",
      "/club/sponsors/goal-1/request",
    );
    expect(within(second).getByText("Partial fit")).toBeInTheDocument();
    expect(within(second).queryByText(/BDT/)).not.toBeInTheDocument();
  });

  it("searches after a pause in typing", async () => {
    render(<ClubMatchesPage />);
    await screen.findAllByRole("article");
    vi.useFakeTimers();
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "need sponsor for a career fair" },
    });
    expect(listCompanyMatches).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(listCompanyMatches).toHaveBeenCalledTimes(2);
    expect(listCompanyMatches).toHaveBeenLastCalledWith(
      ACCESS_TOKEN,
      "need sponsor for a career fair",
      expect.anything(),
    );
  });

  it("shows the no suggestions state", async () => {
    vi.mocked(listCompanyMatches).mockResolvedValue({ items: [] });
    render(<ClubMatchesPage />);
    expect(await screen.findByText("No suggestions yet.")).toBeInTheDocument();
  });

  it("shows the no search results state", async () => {
    render(<ClubMatchesPage />);
    await screen.findAllByRole("article");
    vi.mocked(listCompanyMatches).mockResolvedValue({ items: [] });
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "chess" } });
    expect(await screen.findByText("No companies match your words.")).toBeInTheDocument();
  });

  it("shows an error with retry", async () => {
    vi.mocked(listCompanyMatches).mockRejectedValueOnce(new Error("x"));
    render(<ClubMatchesPage />);
    expect(await screen.findByText("Could not load companies")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findAllByRole("article")).toHaveLength(2);
  });

  it("sends a club with no profile to the profile builder", async () => {
    vi.mocked(listCompanyMatches).mockRejectedValue(
      new ApiError("club_profile_not_found", "x", 404),
    );
    render(<ClubMatchesPage />);
    const link = await screen.findByRole("link", {
      name: "Build your club profile to see matches",
    });
    expect(link).toHaveAttribute("href", "/club/profile");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("asks a club with a draft profile to publish it", async () => {
    vi.mocked(listCompanyMatches).mockRejectedValue(
      new ApiError("club_profile_not_published", "x", 409),
    );
    render(<ClubMatchesPage />);
    const link = await screen.findByRole("link", { name: "Publish your profile to see matches" });
    expect(link).toHaveAttribute("href", "/club/profile");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
