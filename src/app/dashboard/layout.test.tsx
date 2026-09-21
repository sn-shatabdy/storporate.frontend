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

import DashboardLayout from "./layout";

const replaceMock = vi.fn();

beforeEach(() => {
  replaceMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("DashboardLayout — authorization gate (STOR-43 /dashboard/visibility)", () => {
  it("renders the loading placeholder while the session is loading", () => {
    vi.mocked(useSession).mockReturnValue({
      data: undefined,
      status: "loading",
    } as never);
    render(
      <DashboardLayout>
        <div>visibility shell</div>
      </DashboardLayout>,
    );
    expect(screen.getByText(/Checking access…/i)).toBeInTheDocument();
    expect(screen.queryByText("visibility shell")).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("renders the children when the visitor is an authenticated Student", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { actorType: "Student", accessToken: "t" } as never,
      status: "authenticated",
    } as never);
    render(
      <DashboardLayout>
        <div>visibility shell</div>
      </DashboardLayout>,
    );
    expect(screen.getByText("visibility shell")).toBeInTheDocument();
    expect(screen.queryByText(/Checking access…/i)).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated visitors to /login", () => {
    vi.mocked(useSession).mockReturnValue({
      data: undefined,
      status: "unauthenticated",
    } as never);
    render(
      <DashboardLayout>
        <div>visibility shell</div>
      </DashboardLayout>,
    );
    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("visibility shell")).not.toBeInTheDocument();
  });

  it("redirects authenticated Organizations to /", () => {
    // The employer feature is gated by the (employer) layout — an
    // Organization who follows a stale link to /dashboard/visibility
    // should bounce to /, not see the student dashboard shell.
    vi.mocked(useSession).mockReturnValue({
      data: { actorType: "Organization", accessToken: "t" } as never,
      status: "authenticated",
    } as never);
    render(
      <DashboardLayout>
        <div>visibility shell</div>
      </DashboardLayout>,
    );
    expect(replaceMock).toHaveBeenCalledWith("/");
    expect(screen.queryByText("visibility shell")).not.toBeInTheDocument();
  });

  it("redirects authenticated Administrators to /", () => {
    vi.mocked(useSession).mockReturnValue({
      data: { actorType: "Administrator", accessToken: "t" } as never,
      status: "authenticated",
    } as never);
    render(
      <DashboardLayout>
        <div>visibility shell</div>
      </DashboardLayout>,
    );
    expect(replaceMock).toHaveBeenCalledWith("/");
    expect(screen.queryByText("visibility shell")).not.toBeInTheDocument();
  });

  it("redirects authenticated session with error to /login", () => {
    // Defensive: an authenticated session with a session.error is
    // treated as not-signed-in by the gate (matches the header's
    // behavior). Should bounce to /login, not /.
    vi.mocked(useSession).mockReturnValue({
      data: { error: "RefreshAccessTokenError", actorType: "Student" } as never,
      status: "authenticated",
    } as never);
    render(
      <DashboardLayout>
        <div>visibility shell</div>
      </DashboardLayout>,
    );
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
