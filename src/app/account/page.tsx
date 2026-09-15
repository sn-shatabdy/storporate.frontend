"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";

import { SessionCard } from "@/components/account/session-card";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import { listSessions, logoutAllSessions, logoutCurrentSession, type SessionItem } from "@/lib/api/auth";

function initialsFor(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[^a-zA-Z0-9]/g, "");
  return cleaned.length === 0 ? "?" : cleaned.slice(0, 2).toUpperCase();
}

export default function AccountPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [sessions, setSessions] = useState<SessionItem[] | null>(null);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [loggingOutCurrent, setLoggingOutCurrent] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const accessToken = session?.accessToken;

  // Inline async IIFE (matching the existing diagnostics page's pattern in
  // src/app/page.tsx) rather than an extracted useCallback — the
  // react-hooks/set-state-in-effect lint rule can't see through an extracted
  // async function to confirm its setState calls are gated behind an
  // `await`, and flags it as an error even though this is the same "fetch
  // once on mount, abort on unmount" pattern.
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();

    (async () => {
      try {
        const result = await listSessions(accessToken, controller.signal);
        setSessions(result.sessions);
        setSessionsError(null);
      } catch {
        if (controller.signal.aborted) return;
        setSessionsError("Could not load active sessions.");
      }
    })();

    return () => controller.abort();
  }, [accessToken]);

  if (status === "loading") {
    return (
      <div className="theme-bolivian flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--auth-page-bg)" }}>
        <p className="text-sm" style={{ color: "var(--auth-text-muted)" }}>
          Loading your account…
        </p>
      </div>
    );
  }

  if (!session || session.error) {
    // The proxy already redirects unauthenticated visitors to /login; this
    // covers the brief moment a `RefreshFailed` session becomes visible
    // client-side (e.g. logged out on another device) before that redirect
    // catches up.
    return (
      <div className="theme-bolivian flex min-h-screen items-center justify-center" style={{ backgroundColor: "var(--auth-page-bg)" }}>
        <p className="text-sm" style={{ color: "var(--auth-text-muted)" }}>
          Your session ended. Redirecting to sign in…
        </p>
      </div>
    );
  }

  const email = session.user.email ?? "";
  const actorType = session.actorType;
  const isVerified = session.verificationStatus === "Verified";

  async function handleLogoutCurrent() {
    if (!accessToken) return;
    setLoggingOutCurrent(true);
    try {
      await logoutCurrentSession(accessToken);
    } catch {
      // Best-effort — proceed to clear the local session regardless.
    }
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  }

  async function handleLogoutAllConfirmed() {
    if (!accessToken) return;
    setLoggingOutAll(true);
    try {
      await logoutAllSessions(accessToken);
    } catch {
      // Best-effort — proceed to clear the local session regardless, since
      // logout-all revokes the caller's own session too.
    }
    setLoggingOutAll(false);
    setConfirmOpen(false);
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="theme-bolivian min-h-screen px-4 py-10 sm:px-6" style={{ backgroundColor: "var(--auth-page-bg)" }}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <h1 className="font-heading-auth text-3xl font-semibold" style={{ color: "var(--auth-text-primary)" }}>
          Account
        </h1>

        <section
          className="flex flex-col gap-4 rounded-2xl border p-6 sm:flex-row sm:items-center"
          style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-card-bg)" }}
        >
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
            style={{ backgroundColor: "var(--auth-accent)" }}
          >
            {initialsFor(email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold" style={{ color: "var(--auth-text-primary)" }}>
              {email}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ backgroundColor: "var(--auth-tint-1)", color: "var(--auth-text-primary)" }}
              >
                {actorType}
              </span>
              <span
                className="rounded-full px-2.5 py-1 text-xs font-semibold"
                style={
                  isVerified
                    ? { backgroundColor: "#E6F4EA", color: "#1E7B34" }
                    : { backgroundColor: "var(--auth-tint-2)", color: "var(--auth-text-primary)" }
                }
              >
                {isVerified ? "Verified" : "Pending verification"}
              </span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading-auth text-lg font-semibold" style={{ color: "var(--auth-text-primary)" }}>
              Active sessions
            </h2>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-[#B3261E]/20"
              style={{ borderColor: "#B3261E", color: "#B3261E" }}
            >
              <LogOut className="size-4" />
              Log out of all devices
            </button>
          </div>

          {sessionsError && <p className="text-sm text-[#B3261E]">{sessionsError}</p>}

          {sessions === null && !sessionsError ? (
            <p className="text-sm" style={{ color: "var(--auth-text-muted)" }}>
              Loading sessions…
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions?.map((item) => (
                <SessionCard
                  key={item.sessionId}
                  session={item}
                  onLogout={item.isCurrent ? handleLogoutCurrent : undefined}
                  loggingOut={item.isCurrent ? loggingOutCurrent : false}
                />
              ))}
              {sessions?.length === 0 && (
                <p className="text-sm" style={{ color: "var(--auth-text-muted)" }}>
                  No active sessions.
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Log out of all devices?"
        description="This will end your session on every other device. You'll need to sign in again on each one."
        confirmLabel="Log out everywhere"
        confirmLoading={loggingOutAll}
        onConfirm={handleLogoutAllConfirmed}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
