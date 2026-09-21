import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// Mocks MUST be hoisted before the page module is imported.
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

vi.mock("@/lib/api/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/auth")>("@/lib/api/auth");
  return {
    ...actual,
    requestOtp: vi.fn(),
    verifyOtp: vi.fn(),
    googleLogin: vi.fn(),
  };
});

import { signIn, useSession } from "next-auth/react";
import {
  type AuthResult,
  requestOtp,
  verifyOtp,
} from "@/lib/api/auth";

import LoginPage from "./page";

const pushMock = vi.fn();
const refreshMock = vi.fn();

function authResult(actorType: string): AuthResult {
  return {
    userId: "u-1",
    email: "ada@example.com",
    actorType,
    verificationStatus: "Verified",
    isNewUser: false,
    accessToken: "a",
    accessTokenExpiresAt: "2026-09-21T00:15:00Z",
    refreshToken: "r",
    refreshTokenExpiresAt: "2026-09-22T00:00:00Z",
  };
}

beforeEach(() => {
  pushMock.mockReset();
  refreshMock.mockReset();
  vi.mocked(useSession).mockReturnValue({
    data: null,
    status: "unauthenticated",
  } as never);
  vi.mocked(requestOtp).mockResolvedValue({ message: "ok" });
  // signIn's "backend-session" branch resolves with no error.
  vi.mocked(signIn).mockResolvedValue({ error: undefined } as never);
});

afterEach(() => {
  cleanup();
});

/**
 * STOR-43 Phase 4 — Organizations land on /employer/search after sign-in
 * while every other actor type lands on /account. This test exercises the
 * OTP happy path end-to-end and asserts the post-OTP `router.push` target
 * based on the `actorType` returned by the backend.
 */
describe("LoginPage — post-OTP landing route", () => {
  it("lands an Organization on /employer/search after a successful OTP verify", async () => {
    vi.mocked(verifyOtp).mockResolvedValue(authResult("Organization"));

    render(<LoginPage />);

    // Step 1: email.
    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: "ada@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Continue with email/i }),
      );
    });

    // Step 2: enter the 6-digit code (one box per digit, aria-label
    // "Digit 1 of 6" ... "Digit 6 of 6").
    for (let i = 1; i <= 6; i++) {
      const input = screen.getByLabelText(`Digit ${i} of 6`);
      fireEvent.change(input, { target: { value: String(i) } });
    }

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Verify code/i }));
    });

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "ada@example.com",
      code: "123456",
    });
    expect(pushMock).toHaveBeenCalledWith("/employer/search");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("lands a Student on /account after a successful OTP verify", async () => {
    vi.mocked(verifyOtp).mockResolvedValue(authResult("Student"));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: "ada@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Continue with email/i }),
      );
    });

    for (let i = 1; i <= 6; i++) {
      fireEvent.change(screen.getByLabelText(`Digit ${i} of 6`), {
        target: { value: String(i) },
      });
    }

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Verify code/i }));
    });

    expect(pushMock).toHaveBeenCalledWith("/account");
  });

  it("lands a University on /account (not the employer route)", async () => {
    vi.mocked(verifyOtp).mockResolvedValue(authResult("University"));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: "ada@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Continue with email/i }),
      );
    });

    for (let i = 1; i <= 6; i++) {
      fireEvent.change(screen.getByLabelText(`Digit ${i} of 6`), {
        target: { value: String(i) },
      });
    }

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Verify code/i }));
    });

    expect(pushMock).toHaveBeenCalledWith("/account");
  });

  it("lands a Club on /club/profile after a successful OTP verify", async () => {
    vi.mocked(verifyOtp).mockResolvedValue(authResult("Club"));

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/Email address/i), {
      target: { value: "ada@example.com" },
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Continue with email/i }),
      );
    });

    for (let i = 1; i <= 6; i++) {
      fireEvent.change(screen.getByLabelText(`Digit ${i} of 6`), {
        target: { value: String(i) },
      });
    }

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Verify code/i }));
    });

    expect(pushMock).toHaveBeenCalledWith("/club/profile");
  });
});
