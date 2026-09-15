import type { DefaultSession } from "next-auth";

/**
 * Extends NextAuth's built-in `Session`/`JWT`/`User` shapes with the
 * Storporate backend's own token pair and account fields, threaded through
 * in `src/lib/auth/options.ts`'s `jwt`/`session` callbacks. NextAuth itself
 * only ever sees these as opaque strings — the backend remains the sole
 * source of truth for what they mean.
 *
 * Augmenting `"next-auth"`/`"next-auth/jwt"` alone does not reach the actual
 * `Session`/`User`/`JWT` interfaces used by `NextAuthConfig`'s callbacks —
 * `next-auth`'s own `.d.ts` re-exports (`export type { Session, ... } from
 * "@auth/core/types"`) rather than declaring them itself, so TypeScript's
 * declaration merging has to target the original `@auth/core/types` /
 * `@auth/core/jwt` modules directly (confirmed by `npm run build`'s
 * TypeScript pass failing until this was fixed).
 */
declare module "@auth/core/types" {
  interface Session extends DefaultSession {
    user: {
      id: string;
    } & DefaultSession["user"];
    actorType: string;
    verificationStatus: string;
    accessToken: string;
    /**
     * Set when the backend access token could not be refreshed (the refresh
     * token was invalid, reused/revoked, or a Google sign-in for a brand-new
     * account is waiting on an account-type choice). The app treats any
     * truthy value here as "not really signed in yet."
     */
    error?: "RefreshFailed" | "ActorTypeRequired" | "GoogleLoginFailed";
    /**
     * Only set while `error === "ActorTypeRequired"` after a Google sign-in
     * for a brand-new email — the frontend resubmits this same ID token with
     * the chosen `actorType` to finish registration (see `GoogleLoginHandler`'s
     * "ID token is not one-time, safe to resubmit" contract).
     */
    pendingGoogleIdToken?: string;
  }

  interface User {
    actorType?: string;
    verificationStatus?: string;
    accessToken?: string;
    accessTokenExpiresAt?: string;
    refreshToken?: string;
    refreshTokenExpiresAt?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    actorType?: string;
    verificationStatus?: string;
    accessToken?: string;
    accessTokenExpiresAt?: string;
    refreshToken?: string;
    refreshTokenExpiresAt?: string;
    pendingGoogleIdToken?: string;
    error?: "RefreshFailed" | "ActorTypeRequired" | "GoogleLoginFailed";
  }
}
