import { apiCall } from "./client";

/**
 * The four fixed account types a user chooses once at registration (STOR-61).
 * Mirrors `Storporate.SharedKernel.Entities.ActorTypes` exactly — string
 * constants, not an enum, matching the backend's own wire values.
 */
export const ACTOR_TYPES = ["Student", "Organization", "University", "Club"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** Mirrors `Storporate.SharedKernel.Entities.VerificationStatuses`. */
export type VerificationStatus = "Verified" | "Unverified";

/** Mirrors `Storporate.Modules.Identity.RequestOtpResponse`. */
export interface RequestOtpResult {
  message: string;
}

/**
 * Shared shape of a successful email-OTP or Google login/registration —
 * mirrors `VerifyOtpResponse`/`GoogleLoginResponse`, which are identical.
 */
export interface AuthResult {
  userId: string;
  email: string;
  actorType: string;
  verificationStatus: string;
  isNewUser: boolean;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

/** Mirrors `Storporate.Modules.Identity.RefreshSessionResponse`. */
export interface RefreshResult {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

/** Mirrors `Storporate.Modules.Identity.GetCurrentUserResponse`. */
export interface CurrentUserResult {
  userId: string;
  email: string;
  actorType: string;
  verificationStatus: string;
}

/** Mirrors `Storporate.Modules.Identity.ListSessionsSessionItem`. */
export interface SessionItem {
  sessionId: string;
  createdAt: string;
  userAgent: string | null;
  isCurrent: boolean;
}

/** Mirrors `Storporate.Modules.Identity.ListSessionsResponse`. */
export interface ListSessionsResult {
  sessions: SessionItem[];
}

/**
 * `POST /api/auth/otp/request` — always returns the same body/status
 * regardless of whether `email` has an account (no enumeration leak, see
 * `RequestOtpHandler`).
 */
export async function requestOtp(email: string, signal?: AbortSignal): Promise<RequestOtpResult> {
  return apiCall<RequestOtpResult>("POST", "/api/auth/otp/request", {
    body: { email },
    signal,
  });
}

/**
 * `POST /api/auth/otp/verify`. `actorType` is omitted (or `null`) for the
 * first attempt on any email; if the backend responds with the
 * `actor_type_required` error code (a brand-new email), the exact same
 * `email`/`code` can be resubmitted with a chosen `actorType` — the code is
 * not consumed and no attempt is spent on that specific failure path (see
 * `VerifyOtpHandler`: the `ActorTypeRequiredException` throws before
 * `SaveChangesAsync`).
 */
export async function verifyOtp(
  params: { email: string; code: string; actorType?: string | null },
  signal?: AbortSignal,
): Promise<AuthResult> {
  return apiCall<AuthResult>("POST", "/api/auth/otp/verify", {
    body: {
      email: params.email,
      code: params.code,
      actorType: params.actorType ?? null,
    },
    signal,
  });
}

/**
 * `POST /api/auth/google`. Mirrors {@link verifyOtp}'s "actorType only
 * required for a brand-new account" rule — the Google ID token is not a
 * one-time code, so resubmitting it with a chosen `actorType` after an
 * `actor_type_required` response is always safe (see `GoogleLoginHandler`).
 */
export async function googleLogin(
  params: { idToken: string; actorType?: string | null },
  signal?: AbortSignal,
): Promise<AuthResult> {
  return apiCall<AuthResult>("POST", "/api/auth/google", {
    body: { idToken: params.idToken, actorType: params.actorType ?? null },
    signal,
  });
}

/** `POST /api/auth/refresh`. */
export async function refreshSession(refreshToken: string, signal?: AbortSignal): Promise<RefreshResult> {
  return apiCall<RefreshResult>("POST", "/api/auth/refresh", {
    body: { refreshToken },
    signal,
  });
}

/**
 * `POST /api/auth/logout` — revokes only the CALLER's own current session,
 * identified server-side by the `sid` claim on the bearer access token.
 * `LogoutHandler` has no way to target a different session, so this can only
 * ever log out "this device."
 */
export async function logoutCurrentSession(accessToken: string, signal?: AbortSignal): Promise<void> {
  await apiCall<void>("POST", "/api/auth/logout", { bearerToken: accessToken, signal });
}

/** `POST /api/auth/logout-all` — revokes every non-revoked session for the caller. */
export async function logoutAllSessions(
  accessToken: string,
  signal?: AbortSignal,
): Promise<{ revokedSessions: number }> {
  return apiCall<{ revokedSessions: number }>("POST", "/api/auth/logout-all", {
    bearerToken: accessToken,
    signal,
  });
}

/** `GET /api/auth/me`. */
export async function getCurrentUser(accessToken: string, signal?: AbortSignal): Promise<CurrentUserResult> {
  return apiCall<CurrentUserResult>("GET", "/api/auth/me", { bearerToken: accessToken, signal });
}

/** `GET /api/auth/sessions`. */
export async function listSessions(accessToken: string, signal?: AbortSignal): Promise<ListSessionsResult> {
  return apiCall<ListSessionsResult>("GET", "/api/auth/sessions", { bearerToken: accessToken, signal });
}
