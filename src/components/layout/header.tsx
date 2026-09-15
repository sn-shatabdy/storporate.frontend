"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, User } from "lucide-react";
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
    <header className="flex w-full items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
      <Link href="/" aria-label="Storporate home">
        <Wordmark />
      </Link>

      {status === "loading" ? (
        <div className="h-8 w-20 animate-pulse rounded-full bg-muted" aria-hidden />
      ) : isSignedIn && session ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-full border border-border bg-background px-2 py-1 pr-3 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className="flex size-[30px] items-center justify-center rounded-full bg-[#4D7EA0] text-xs font-semibold text-white">
              {initialsFor(session.user.email ?? "?")}
            </span>
            <span className="max-w-[10rem] truncate">{session.user.email}</span>
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
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:outline-none"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      ) : (
        <Button asChild size="sm">
          <Link href="/login">Continue</Link>
        </Button>
      )}
    </header>
  );
}
