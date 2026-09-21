import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const replaceMock = vi.fn();

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

import { useSession } from "next-auth/react";

import ClubLayout from "./layout";

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => cleanup());

function renderLayout() {
  return render(
    <ClubLayout>
      <div>club shell</div>
    </ClubLayout>,
  );
}

describe("ClubLayout authorization gate", () => {
  it("shows the checking state while the session loads", () => {
    vi.mocked(useSession).mockReturnValue({ data: undefined, status: "loading" } as never);
    renderLayout();
    expect(screen.getByText("Checking access…")).toBeInTheDocument();
    expect(screen.queryByText("club shell")).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("renders children for an authenticated Club", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { actorType: "Club", accessToken: "t" },
      status: "authenticated",
    } as never);
    renderLayout();
    expect(screen.getByText("club shell")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("sends unauthenticated visitors to /login", () => {
    vi.mocked(useSession).mockReturnValue({
      data: undefined,
      status: "unauthenticated",
    } as never);
    renderLayout();
    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("club shell")).not.toBeInTheDocument();
  });

  it.each(["Student", "Organization", "Administrator", "University"])(
    "sends a %s to /",
    (actorType) => {
      vi.mocked(useSession).mockReturnValue({
        data: { actorType, accessToken: "t" },
        status: "authenticated",
      } as never);
      renderLayout();
      expect(replaceMock).toHaveBeenCalledWith("/");
      expect(screen.queryByText("club shell")).not.toBeInTheDocument();
    },
  );

  it("treats a session with an error as signed out", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { actorType: "Club", error: "RefreshAccessTokenError" },
      status: "authenticated",
    } as never);
    renderLayout();
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
