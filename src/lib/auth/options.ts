import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { ApiError } from "@/lib/api/errors";
import { googleLogin, refreshSession } from "@/lib/api/auth";

// Refresh the backend access token this many milliseconds before it actually
// expires, so a request that lands right at the boundary never gets a token
// the backend is about to reject.
const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;

/**
 * NextAuth is used purely as a session-management layer on top of the
 * Storporate backend, which remains the sole source of truth for
 * authentication:
 *
 * - The email-OTP flow is verified directly against the backend
 *   (`src/lib/api/auth.ts`'s `verifyOtp`) from the login page itself, not
 *   from this file — the OTP code is single-use (the backend marks it
 *   consumed on the same `SaveChangesAsync` call that succeeds), so it can
 *   only ever be submitted once. The "backend-session" Credentials provider
 *   below therefore does not re-verify anything; it only accepts an
 *   already-issued backend token pair and wraps it into a NextAuth session.
 * - Google sign-in runs NextAuth's own OAuth browser handshake (the `Google`
 *   provider below), then forwards the resulting ID token to the backend's
 *   `POST /api/auth/google` from the `jwt` callback the first time a given
 *   Google account signs in — the ID token itself is not one-time, so this
 *   is safe to call exactly once per NextAuth sign-in.
 *
 * No NextAuth database adapter: `session: { strategy: "jwt" }` keeps
 * everything in the encrypted session cookie, since the backend already owns
 * durable session state (`Sessions` table, refresh rotation, theft
 * detection).
 */
const config: NextAuthConfig = {
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      id: "backend-session",
      name: "Storporate session",
      credentials: {
        userId: { label: "userId", type: "text" },
        email: { label: "email", type: "text" },
        actorType: { label: "actorType", type: "text" },
        verificationStatus: { label: "verificationStatus", type: "text" },
        accessToken: { label: "accessToken", type: "text" },
        accessTokenExpiresAt: { label: "accessTokenExpiresAt", type: "text" },
        refreshToken: { label: "refreshToken", type: "text" },
        refreshTokenExpiresAt: { label: "refreshTokenExpiresAt", type: "text" },
      },
      // No network call here on purpose — see the file-level doc comment.
      // The caller (src/app/login/page.tsx) has already completed a real
      // verify/google call against the backend before invoking `signIn`.
      authorize: async (raw) => {
        const c = raw as Record<string, string | undefined>;
        if (!c.userId || !c.email || !c.accessToken || !c.refreshToken) {
          return null;
        }
        return {
          id: c.userId,
          email: c.email,
          actorType: c.actorType,
          verificationStatus: c.verificationStatus,
          accessToken: c.accessToken,
          accessTokenExpiresAt: c.accessTokenExpiresAt,
          refreshToken: c.refreshToken,
          refreshTokenExpiresAt: c.refreshTokenExpiresAt,
        };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Fresh sign-in through the "backend-session" bridge: the login page
      // already has a full token pair from a direct verify/google call.
      if (user && account?.provider === "backend-session") {
        token.userId = user.id;
        token.email = user.email ?? token.email;
        token.actorType = user.actorType;
        token.verificationStatus = user.verificationStatus;
        token.accessToken = user.accessToken;
        token.accessTokenExpiresAt = user.accessTokenExpiresAt;
        token.refreshToken = user.refreshToken;
        token.refreshTokenExpiresAt = user.refreshTokenExpiresAt;
        delete token.pendingGoogleIdToken;
        delete token.error;
        return token;
      }

      // Fresh Google sign-in: NextAuth already ran the OAuth handshake.
      // Forward the resulting ID token to our own backend so OUR tokens
      // become the source of truth (never trust the frontend's own claim).
      if (account?.provider === "google" && account.id_token) {
        try {
          const result = await googleLogin({ idToken: account.id_token, actorType: null });
          token.userId = result.userId;
          token.email = result.email;
          token.actorType = result.actorType;
          token.verificationStatus = result.verificationStatus;
          token.accessToken = result.accessToken;
          token.accessTokenExpiresAt = result.accessTokenExpiresAt;
          token.refreshToken = result.refreshToken;
          token.refreshTokenExpiresAt = result.refreshTokenExpiresAt;
          delete token.pendingGoogleIdToken;
          delete token.error;
        } catch (error) {
          if (error instanceof ApiError && error.errorCode === "actor_type_required") {
            // Brand-new Google account: stash the (reusable) ID token so the
            // login page can finish registration once the user picks a type.
            token.pendingGoogleIdToken = account.id_token;
            token.error = "ActorTypeRequired";
          } else {
            token.error = "GoogleLoginFailed";
          }
        }
        return token;
      }

      // Every subsequent request: refresh the backend access token if it's
      // close to (or past) its own expiry.
      if (token.accessTokenExpiresAt && token.refreshToken) {
        const expiresAt = new Date(token.accessTokenExpiresAt).getTime();
        if (Date.now() > expiresAt - ACCESS_TOKEN_REFRESH_SKEW_MS) {
          try {
            const refreshed = await refreshSession(token.refreshToken);
            token.accessToken = refreshed.accessToken;
            token.accessTokenExpiresAt = refreshed.accessTokenExpiresAt;
            token.refreshToken = refreshed.refreshToken;
            token.refreshTokenExpiresAt = refreshed.refreshTokenExpiresAt;
            delete token.error;
          } catch {
            // Refresh token invalid/reused/revoked (e.g. "log out of all
            // devices" from another tab) — the session callback surfaces
            // this so the app can force a sign-out.
            token.error = "RefreshFailed";
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId;
      if (token.email) session.user.email = token.email;
      session.actorType = token.actorType ?? "";
      session.verificationStatus = token.verificationStatus ?? "";
      session.accessToken = token.accessToken ?? "";
      session.error = token.error;
      session.pendingGoogleIdToken = token.pendingGoogleIdToken;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);
