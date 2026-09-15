"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Thin client-boundary wrapper so `RootLayout` (a Server Component) can still
 * provide the NextAuth session context to the whole app. `useSession()` in
 * `Header` and the account/login pages depends on this being present above
 * them in the tree.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
