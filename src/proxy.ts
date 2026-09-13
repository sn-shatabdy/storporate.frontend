import { auth } from "@/lib/auth/options";

/**
 * DEVIATION from the plan's literal `src/middleware.ts` filename: Next.js 16
 * deprecated the `middleware.ts` file convention and renamed it to
 * `proxy.ts` (same runtime behavior, `middleware` export renamed to
 * `proxy`/default export — see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
 * Functionally identical to what the plan describes; only the file name and
 * export name follow the current framework convention instead of the
 * deprecated one.
 *
 * Protects `/account`: an unauthenticated visitor (no session, or a session
 * whose backend refresh failed — see `session.error` in `options.ts`) is
 * redirected to `/login`.
 */
export default auth((req) => {
  const isSignedIn = Boolean(req.auth) && !req.auth?.error;
  const isAccountRoute = req.nextUrl.pathname.startsWith("/account");

  if (isAccountRoute && !isSignedIn) {
    const loginUrl = new URL("/login", req.nextUrl);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/account/:path*"],
};
