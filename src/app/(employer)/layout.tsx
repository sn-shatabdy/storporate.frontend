"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Client-side guard for the `(employer)` route group. The backend's
 * `[RequirePermission]` gate on `/api/discovery/talent-searches/*` is
 * the real authorization check; this guard just bounces non-Organization
 * visitors off the URL before they ever see the search shell.
 *
 * Mirrors the loading/error-state pattern from the `(admin)` and
 * `/dashboard` guards (`src/app/(admin)/layout.tsx` and
 * `src/app/dashboard/layout.tsx`) so the three guarded surfaces present
 * consistent auth transitions.
 *
 * Deviations from the admin layout's literal copy:
 *   - Admin uses `actorType === "Administrator"` and redirects everyone
 *     who isn't an Administrator to "/". Here the Organization is the
 *     only actor who may see the page; Students and Administrators
 *     both get redirected to "/". An unauthenticated viewer is sent to
 *     "/login" instead of "/" (matching the `/dashboard` layout's
 *     pre-existing behavior, so the auth transitions are identical
 *     for unauthenticated users regardless of which guarded route
 *     they hit).
 *   - The loading text is "Checking access…" — same wording as the
 *     admin guard, intentionally.
 */
export default function EmployerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const isSignedIn =
    status === "authenticated" && !!session && !session.error;
  const isOrganization = session?.actorType === "Organization";

  // Single source of truth for "may this visitor see the employer
  // shell?". Consumed by both the redirect effect and the render
  // guard so the two can't disagree at any render.
  const isAuthorized = isSignedIn && isOrganization;

  useEffect(() => {
    // "loading" — wait; "authorized" — do nothing.
    if (status === "loading" || isAuthorized) return;
    // Unauthenticated → /login; authenticated non-Organization → /.
    if (!isSignedIn) {
      router.replace("/login");
    } else {
      router.replace("/");
    }
  }, [status, isAuthorized, isSignedIn, router]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  return <>{children}</>;
}
