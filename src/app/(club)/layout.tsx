"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Client-side guard for the `(club)` route group. The backend enforces the
 * real authorization on `/api/clubs/profile`; this guard sends everyone who
 * is not a Club account away before the builder shows. Same pattern as the
 * `(employer)` guard: unauthenticated visitors go to "/login", signed in
 * visitors of another type go to "/".
 */
export default function ClubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, status } = useSession();

  const isSignedIn =
    status === "authenticated" && !!session && !session.error;
  const isClub = session?.actorType === "Club";
  const isAuthorized = isSignedIn && isClub;

  useEffect(() => {
    if (status === "loading" || isAuthorized) return;
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
