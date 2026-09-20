import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Mocks MUST be hoisted before the layout module is imported.
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

import { useSession } from "next-auth/react";

import EmployerLayout from "./layout";

const replaceMock = vi.fn();

beforeEach(() => {
  replaceMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("EmployerLayout — authorization gate", () => {
  it("renders the loading placeholder while the session is loading", () => {
    vi.mocked(useSession).mockReturnValue({
      data: undefined,
      status: "loading",
    } as never);
    render(
      <EmployerLayout>
        <div>search shell</div>
      </EmployerLayout>,
    );
    expect(screen.getByText(/Checking access…/i)).toBeInTheDocument();
    expect(screen.queryByText("search shell")).not.toBeInTheDocument();
  });

  it("renders the children when the visitor is an authenticated Organization", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { actorType: "Organization", accessToken: "t" } as never,
      status: "authenticated",
    } as never);
    render(
      <EmployerLayout>
        <div>search shell</div>
      </EmployerLayout>,
    );
    expect(screen.getByText("search shell")).toBeInTheDocument();
    expect(screen.queryByText(/Checking access…/i)).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated visitors to /login", () => {
    vi.mocked(useSession).mockReturnValue({
      data: undefined,
      status: "unauthenticated",
    } as never);
    render(
      <EmployerLayout>
        <div>search shell</div>
      </EmployerLayout>,
    );
    expect(screen.getByText(/Checking access…/i)).toBeInTheDocument();
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });

  it("redirects authenticated Students to /", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { actorType: "Student", accessToken: "t" } as never,
      status: "authenticated",
    } as never);
    render(
      <EmployerLayout>
        <div>search shell</div>
      </EmployerLayout>,
    );
    expect(replaceMock).toHaveBeenCalledWith("/");
    expect(screen.queryByText("search shell")).not.toBeInTheDocument();
  });

  it("redirects Administrators to /", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { actorType: "Administrator", accessToken: "t" } as never,
      status: "authenticated",
    } as never);
    render(
      <EmployerLayout>
        <div>search shell</div>
      </EmployerLayout>,
    );
    expect(replaceMock).toHaveBeenCalledWith("/");
    expect(screen.queryByText("search shell")).not.toBeInTheDocument();
  });

  it("redirects to /login when authenticated but the session has an error", () => {
    // Defensive: an authenticated session with a session.error is
    // treated as not-signed-in by the gate (matches the header's
    // behavior). Should bounce to /login, not /.
    vi.mocked(useSession).mockReturnValue({
      data: { error: "RefreshAccessTokenError", actorType: "Organization" } as never,
      status: "authenticated",
    } as never);
    render(
      <EmployerLayout>
        <div>search shell</div>
      </EmployerLayout>,
    );
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
