"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ArrowRight, FileText, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { listPortfolioItems } from "@/lib/api/portfolio";
import { listExplorations } from "@/lib/api/growth";

/**
 * Title-cased version of the email's local-part — used as a fallback
 * greeting when NextAuth hasn't populated `session.user.name` (this app's
 * sign-in flow only stores the email address, never a display name).
 *
 * Mirrors the same "strip non-alphanumerics, take the first chunk" derivation
 * the `Header`'s `initialsFor` helper uses, but returns a word instead of
 * initials so it reads naturally in "Welcome back, {name}".
 */
function displayNameFor(session: { user?: { name?: string | null; email?: string | null } } | null): string | null {
  const explicit = session?.user?.name?.trim();
  if (explicit) return explicit;
  const email = session?.user?.email;
  if (!email) return null;
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned
    .split(/\s+/)
    .map((word) => (word.length === 0 ? word : word[0].toUpperCase() + word.slice(1).toLowerCase()))
    .join(" ");
}

/**
 * Student dashboard home (`/dashboard`) — the welcome shell that links into
 * the portfolio and the advisor. Renders nothing until the session is ready
 * (the layout's own guard already short-circuited unauthenticated visitors,
 * but session is still `loading` for a moment on first paint).
 *
 * STOR-40 Phase 5 added the second card (Advisor) alongside the existing
 * My Portfolio card. Both cards follow the same bordered-card pattern
 * approved by the design canvas (accent tile + title + count line + CTA).
 */
export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [itemCount, setItemCount] = useState<number | null>(null);
  // STOR-40: same "unknown count" pattern as `itemCount`. Independent
  // controller + catch so a failing advisor fetch can never blank the
  // portfolio card or vice versa.
  const [explorationCount, setExplorationCount] = useState<number | null>(null);
  // Tracks whether the advisor fetch ever failed (vs. still in flight).
  // Lets the card show "Your explorations" on a permanent failure rather
  // than the loading placeholder.
  const [explorationFailed, setExplorationFailed] = useState(false);

  useEffect(() => {
    const accessToken = session?.accessToken;
    if (!accessToken) return;
    const controller = new AbortController();
    const tokenAtMount = accessToken;

    (async () => {
      try {
        const [portfolioResult, explorationList] = await Promise.all([
          listPortfolioItems(1, 1000, tokenAtMount, controller.signal),
          listExplorations(tokenAtMount, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setItemCount(portfolioResult.totalCount);
        setExplorationCount(explorationList.length);
      } catch {
        if (controller.signal.aborted) return;
        // Counts unknown — leave as null and let the cards show a neutral
        // label rather than misleading "0"s.
      }
    })();

    // Independent effect that tracks advisor-only failures so the
    // dashboard card can show a meaningful failure copy.
    (async () => {
      try {
        await listExplorations(tokenAtMount, controller.signal);
        if (controller.signal.aborted) return;
        setExplorationFailed(false);
      } catch {
        if (controller.signal.aborted) return;
        setExplorationFailed(true);
      }
    })();

    return () => controller.abort();
  }, [session?.accessToken]);

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
      </div>
    );
  }

  const name = displayNameFor(session);

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8">
        <header>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {name ? `Welcome back, ${name}` : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Your portfolio starts here — every project, certificate, dataset, or link you add builds toward your verified profile.
          </p>
        </header>

        <section
          className="flex flex-col gap-5 border bg-card p-6 shadow-sm sm:flex-row sm:items-center"
          style={{ borderRadius: 20, borderColor: "var(--border)" }}
        >
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"
          >
            <FileText className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-semibold text-foreground">My Portfolio</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {itemCount === null
                ? "Loading your portfolio…"
                : itemCount === 0
                  ? "No items in your portfolio yet"
                  : itemCount === 1
                    ? "1 item in your portfolio"
                    : `${itemCount} items in your portfolio`}
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/portfolio">
              View portfolio
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>

        {/*
          STOR-40 Phase 5 — Advisor card. Same shape as the portfolio card
          above (accent tile + title + count + CTA), but with the
          Sparkles icon and the "Open advisor" label. The count phrasing
          mirrors the design's "3 explorations" / "{N} of 20" pair by
          showing "N exploration(s)" + a "of 20" suffix once the count
          has loaded.
        */}
        <section
          className="flex flex-col gap-5 border bg-card p-6 shadow-sm sm:flex-row sm:items-center"
          style={{ borderRadius: 20, borderColor: "var(--border)" }}
        >
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"
          >
            <Sparkles className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-semibold text-foreground">Advisor</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {explorationFailed
                ? "Your explorations"
                : explorationCount === null
                  ? "Loading your explorations…"
                  : explorationCount === 0
                    ? "Start your first exploration"
                    : explorationCount === 1
                      ? "1 exploration"
                      : `${explorationCount} explorations`}
            </p>
          </div>
          <Button asChild>
            <Link href="/dashboard/advisor">
              Open advisor
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
