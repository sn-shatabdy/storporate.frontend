"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Client-side guard for the `/dashboard*` routes (the student portfolio
 * surface — STOR-37). The backend's `[RequirePermission]` gates on
 * `/api/portfolio/*` are the real authorization checks; this guard just
 * bounces non-Student visitors off the URL before they ever see the
 * dashboard shell.
 *
 * Mirrors the (admin) layout's loading/redirect pattern
 * (`src/app/(admin)/layout.tsx`) so the two guarded route surfaces present
 * consistent auth transitions. While the redirect is in flight, render
 * nothing — keeps the URL but shows no flash of the dashboard shell to an
 * unprivileged viewer. Same "single `isAuthorized` flag" approach for the
 * same reason the admin layout uses it (the redirect effect and the render
 * guard must agree at every render, otherwise the redirect can fire after
 * the shell has already rendered).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const isSignedIn =
    status === "authenticated" && !!session && !session.error;
  const isStudent = session?.actorType === "Student";

  // Single source of truth for "may this visitor see the dashboard?".
  // Consumed by both the redirect effect and the render guard so the two
  // can't disagree at any render.
  const isAuthorized = isSignedIn && isStudent;

  useEffect(() => {
    // "loading" — wait; "authorized" — do nothing.
    if (status === "loading" || isAuthorized) return;
    // Unauthenticated → /login; authenticated non-Student → /
    // (the portfolio feature is Student-only for now; other actor types
    // landing here means they typed the URL or followed an old link).
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
