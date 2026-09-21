"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Shield, User } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/auth/wordmark";
import { logoutCurrentSession } from "@/lib/api/auth";

function initialsFor(email: string): string {
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[^a-zA-Z0-9]/g, "");
  if (cleaned.length === 0) return "?";
  return cleaned.slice(0, 2).toUpperCase();
}

/**
 * Global site header. Renders nothing on `/login` — the unified auth flow's
 * own `AuthShell` already provides a centered, nav-free wordmark header, and
 * showing this one too would duplicate it (the plan calls for "no nav links
 * on the auth screens").
 */
export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  if (pathname?.startsWith("/login")) {
    return null;
  }

  const isSignedIn = status === "authenticated" && !session?.error;
  const isAdministrator = session?.actorType === "Administrator";
  const isStudent = session?.actorType === "Student";
  // STOR-43 Phase 4 — Organization gets its own single-link nav,
  // mirroring the Student nav's role gating.
  const isOrganization = session?.actorType === "Organization";

  const isDashboardActive = pathname === "/dashboard";
  const isPortfolioActive = pathname === "/dashboard/portfolio";
  // `startsWith` (not `===`) so deep links to sub-routes (e.g. the advisor
  // comparison screen) keep the "Advisor" nav link highlighted.
  const isAdvisorActive = pathname?.startsWith("/dashboard/advisor") ?? false;
  // STOR-43 Phase 3 — same `startsWith` treatment for the visibility page
  // so the nav link stays highlighted if the route grows sub-paths later.
  const isVisibilityActive =
    pathname?.startsWith("/dashboard/visibility") ?? false;
  // STOR-66 — job and internship openings (student browse + detail).
  const isOpeningsActive = pathname?.startsWith("/dashboard/jobs") ?? false;
  // STOR-67 — the student's own applications.
  const isApplicationsActive =
    pathname?.startsWith("/dashboard/applications") ?? false;
  // STOR-68 — the student's invitations and conversations.
  const isInboxActive = pathname?.startsWith("/dashboard/inbox") ?? false;
  // STOR-43 Phase 4 — single-link employer nav; `startsWith` so any
  // future employer sub-routes keep the active state.
  const isEmployerSearchActive =
    pathname?.startsWith("/employer/search") ?? false;
  // STOR-66 — the employer's own openings (list, new, edit).
  const isEmployerJobsActive =
    pathname?.startsWith("/employer/jobs") ?? false;
  // STOR-68 — the employer's shortlist and conversations.
  const isEmployerShortlistActive =
    pathname?.startsWith("/employer/shortlist") ?? false;
  const isEmployerMessagesActive =
    pathname?.startsWith("/employer/messages") ?? false;

  async function handleLogout() {
    setMenuOpen(false);
    try {
      if (session?.accessToken) {
        await logoutCurrentSession(session.accessToken);
      }
    } catch {
      // Best-effort: even if the backend call fails, still clear the local
      // NextAuth session below so the UI reflects "signed out."
    }
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-border/60">
      {/* Phone (below md): two rows — wordmark+account on row 1,
          three student-nav links on row 2. At md+ this collapses
          into a single row with the nav + account on either side of
          the wordmark, exactly as before. */}
      <div className="flex items-center justify-between px-4 pb-2 pt-3 md:hidden">
        <Link href="/" aria-label="Storporate home">
          <Wordmark />
        </Link>
        {status === "loading" ? (
          <div
            className="h-8 w-20 animate-pulse rounded-full bg-muted"
            aria-hidden
          />
        ) : isSignedIn && session ? (
          <AccountMenu
            session={session}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            menuRef={menuRef}
            isAdministrator={isAdministrator}
            onLogout={handleLogout}
            compact
          />
        ) : (
          <Button asChild size="sm">
            <Link href="/login">Continue</Link>
          </Button>
        )}
      </div>
      {isStudent && (
        <div className="border-b border-border/60 px-2.5 md:hidden">
          <StudentNav
            className="flex items-center gap-1 overflow-x-auto whitespace-nowrap py-1"
            isDashboardActive={isDashboardActive}
            isPortfolioActive={isPortfolioActive}
            isAdvisorActive={isAdvisorActive}
            isVisibilityActive={isVisibilityActive}
            isOpeningsActive={isOpeningsActive}
            isApplicationsActive={isApplicationsActive}
            isInboxActive={isInboxActive}
          />
        </div>
      )}
      {isOrganization && (
        <div className="border-b border-border/60 px-2.5 md:hidden">
          <EmployerNav
            className="flex items-center gap-1 overflow-x-auto whitespace-nowrap py-1"
            isSearchActive={isEmployerSearchActive}
            isJobsActive={isEmployerJobsActive}
            isShortlistActive={isEmployerShortlistActive}
            isMessagesActive={isEmployerMessagesActive}
          />
        </div>
      )}

      {/* md+ layout: single row containing wordmark, nav, account. */}
      <div className="hidden w-full items-center justify-between px-4 py-3 sm:px-6 md:flex">
        <div className="flex items-center gap-6">
          <Link href="/" aria-label="Storporate home">
            <Wordmark />
          </Link>
          {isStudent && (
            <StudentNav
              className="flex items-center gap-1"
              isDashboardActive={isDashboardActive}
              isPortfolioActive={isPortfolioActive}
              isAdvisorActive={isAdvisorActive}
              isVisibilityActive={isVisibilityActive}
              isOpeningsActive={isOpeningsActive}
              isApplicationsActive={isApplicationsActive}
              isInboxActive={isInboxActive}
            />
          )}
          {isOrganization && (
            <EmployerNav
              className="flex items-center gap-1"
              isSearchActive={isEmployerSearchActive}
              isJobsActive={isEmployerJobsActive}
              isShortlistActive={isEmployerShortlistActive}
              isMessagesActive={isEmployerMessagesActive}
            />
          )}
        </div>

        {status === "loading" ? (
          <div
            className="h-8 w-20 animate-pulse rounded-full bg-muted"
            aria-hidden
          />
        ) : isSignedIn && session ? (
          <AccountMenu
            session={session}
            menuOpen={menuOpen}
            setMenuOpen={setMenuOpen}
            menuRef={menuRef}
            isAdministrator={isAdministrator}
            onLogout={handleLogout}
          />
        ) : (
          <Button asChild size="sm">
            <Link href="/login">Continue</Link>
          </Button>
        )}
      </div>
    </header>
  );
}

/** Account dropdown shared between the phone and md+ layouts. The
 * `compact` prop hides the email + chevron padding so the avatar-only
 * "account" button fits the phone row 1 layout (12px 16px 8px). */
function AccountMenu({
  session,
  menuOpen,
  setMenuOpen,
  menuRef,
  isAdministrator,
  onLogout,
  compact,
}: {
  session: { user: { email?: string | null } };
  menuOpen: boolean;
  setMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  isAdministrator: boolean;
  onLogout: () => void;
  compact?: boolean;
}) {
  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={
          compact
            ? "flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 pr-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            : "flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1 pr-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        }
      >
        <span className="flex size-[30px] items-center justify-center rounded-full bg-[#4D7EA0] text-xs font-semibold text-white">
          {initialsFor(session.user.email ?? "?")}
        </span>
        {!compact && (
          <span className="max-w-[10rem] truncate">
            {session.user.email}
          </span>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-popover py-1 text-sm text-popover-foreground shadow-lg"
        >
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            <User className="size-4" />
            Account
          </Link>
          {isAdministrator && (
            <Link
              href="/audit-log"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <Shield className="size-4" />
              Audit Log
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Student-only nav links rendered between the wordmark and the account
 * menu. Active state is rendered as a heavier font weight plus a 2px
 * bottom-border accent in the primary color — same general treatment as
 * the account dropdown's active/hover styling, adapted for a top-bar link.
 *
 * Exported (rather than kept module-local) so the visibility-page test
 * suite can assert the "Visibility" link appears with `aria-current="page"`
 * at the agreed pathname without having to mock the entire `Header`
 * surface (which pulls `useSession`, `signOut`, `useRouter`,
 * `usePathname`, etc.).
 */
export function StudentNav({
  className,
  isDashboardActive,
  isPortfolioActive,
  isAdvisorActive,
  isVisibilityActive,
  isOpeningsActive = false,
  isApplicationsActive = false,
  isInboxActive = false,
}: {
  className?: string;
  isDashboardActive: boolean;
  isPortfolioActive: boolean;
  isAdvisorActive: boolean;
  isVisibilityActive: boolean;
  isOpeningsActive?: boolean;
  isApplicationsActive?: boolean;
  isInboxActive?: boolean;
}) {
  return (
    <nav
      aria-label="Student navigation"
      className={className ?? "flex items-center gap-1"}
    >
      <StudentNavLink href="/dashboard" active={isDashboardActive}>
        Dashboard
      </StudentNavLink>
      <StudentNavLink href="/dashboard/portfolio" active={isPortfolioActive}>
        My Portfolio
      </StudentNavLink>
      <StudentNavLink href="/dashboard/advisor" active={isAdvisorActive}>
        Advisor
      </StudentNavLink>
      {/* STOR-43 Phase 3 — opt-in surface for the talent-search index.
          Sits after Advisor so the order matches how a student usually
          moves through the app: explore → reflect → share. */}
      <StudentNavLink href="/dashboard/visibility" active={isVisibilityActive}>
        Visibility
      </StudentNavLink>
      {/* STOR-66 — browse jobs and internships. */}
      <StudentNavLink href="/dashboard/jobs" active={isOpeningsActive}>
        Openings
      </StudentNavLink>
      {/* STOR-67 — applications the student has submitted. */}
      <StudentNavLink
        href="/dashboard/applications"
        active={isApplicationsActive}
      >
        Applications
      </StudentNavLink>
      {/* STOR-68 — invitations from organizations. */}
      <StudentNavLink href="/dashboard/inbox" active={isInboxActive}>
        Inbox
      </StudentNavLink>
    </nav>
  );
}

function StudentNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "relative inline-flex items-center px-1.5 pb-1 text-sm font-semibold text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          : "relative inline-flex items-center px-1.5 pb-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      }
    >
      {children}
    </Link>
  );
}

/**
 * Organization-only nav links rendered between the wordmark and the
 * account menu. Mirrors `StudentNav`'s active/hover styling so the two
 * navs read as the same component family — same `StudentNavLink`-
 * shaped link classes, same aria-current="page" treatment, same
 * focus-visible ring. Currently a single "Search" link to the
 * employer search page; future employer surfaces (saved searches,
 * employer account, etc.) would slot in here.
 *
 * Exported (rather than kept module-local) so the header test suite
 * can assert the "Search" link appears with `aria-current="page"` at
 * /employer/search without having to mock the full `Header` (which
 * pulls `useSession`, `signOut`, `useRouter`, `usePathname`, etc.).
 */
export function EmployerNav({
  className,
  isSearchActive,
  isJobsActive = false,
  isShortlistActive = false,
  isMessagesActive = false,
}: {
  className?: string;
  isSearchActive: boolean;
  isJobsActive?: boolean;
  isShortlistActive?: boolean;
  isMessagesActive?: boolean;
}) {
  return (
    <nav
      aria-label="Employer navigation"
      className={className ?? "flex items-center gap-1"}
    >
      <StudentNavLink href="/employer/search" active={isSearchActive}>
        Search
      </StudentNavLink>
      <StudentNavLink href="/employer/jobs" active={isJobsActive}>
        Jobs
      </StudentNavLink>
      {/* STOR-68 — saved students and invitations sent. */}
      <StudentNavLink href="/employer/shortlist" active={isShortlistActive}>
        Shortlist
      </StudentNavLink>
      <StudentNavLink href="/employer/messages" active={isMessagesActive}>
        Messages
      </StudentNavLink>
    </nav>
  );
}
