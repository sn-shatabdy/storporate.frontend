import type { ReactNode } from "react";

import { Wordmark } from "@/components/auth/wordmark";

/**
 * Shared full-height shell for every unified-auth-flow screen: a deliberately
 * composed background (two soft blurred color blobs in opposite corners,
 * never a bare white page), a centered wordmark-only header (no nav links —
 * there's no separate login/register page to link between), and a centered
 * card. The global `Header` component renders nothing on `/login`, so this
 * is the only header on the page.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="theme-bolivian relative flex min-h-screen flex-col items-center overflow-hidden px-4 py-10 sm:py-14"
      style={{ backgroundColor: "var(--auth-page-bg)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 -left-28 size-72 rounded-full opacity-80 blur-3xl sm:size-96"
        style={{ backgroundColor: "var(--auth-soft-1)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -bottom-32 size-80 rounded-full opacity-80 blur-3xl sm:size-[26rem]"
        style={{ backgroundColor: "var(--auth-soft-2)" }}
      />

      <div className="relative z-10 mb-8 sm:mb-10">
        <Wordmark />
      </div>

      <div
        className="relative z-10 w-full max-w-md rounded-[22px] border p-9 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(42,24,48,0.18)] sm:p-10"
        style={{ backgroundColor: "var(--auth-card-bg)", borderColor: "var(--auth-border)" }}
      >
        {children}
      </div>
    </div>
  );
}
