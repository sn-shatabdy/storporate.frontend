"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Client-side guard for the `(admin)` route group. The backend's
 * `[RequirePermission]` gate on `/api/security-governance/audit-log` is the
 * real authorization check; this guard just bounces non-Administrator
 * visitors off the URL before they ever see the page shell.
 *
 * Mirrors the loading/error-state pattern already used by /account (see
 * `src/app/account/page.tsx`'s `status === "loading"` / `session.error`
 * branches) so the two guarded pages present consistent auth transitions.
 * While the redirect is in flight, render nothing — keeps the URL but
 * shows no flash of the admin shell to an unprivileged viewer.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Single source of truth for "may this visitor see the admin shell?".
  // Consumed by both the redirect effect (so the redirect goes away the
  // moment authorization fails) and the render guard (so the loading
  // placeholder disappears at the same moment).
  const isAuthorized =
    status === "authenticated" &&
    !!session &&
    !session.error &&
    session.actorType === "Administrator";

  useEffect(() => {
    if (status === "loading" || isAuthorized) return;
    router.replace("/");
  }, [status, isAuthorized, router]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    );
  }

  return <>{children}</>;
}
