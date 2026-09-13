import { Laptop, Smartphone } from "lucide-react";

import type { SessionItem } from "@/lib/api/auth";
import { formatRelativeTime } from "@/lib/utils/relative-time";
import { parseUserAgent } from "@/lib/utils/user-agent";

interface SessionCardProps {
  session: SessionItem;
  onLogout?: () => void;
  loggingOut?: boolean;
}

export function SessionCard({ session, onLogout, loggingOut }: SessionCardProps) {
  const { label, deviceKind } = parseUserAgent(session.userAgent);
  const Icon = deviceKind === "mobile" ? Smartphone : Laptop;

  return (
    <div
      className="flex items-center gap-3.5 rounded-xl border p-4"
      style={{ borderColor: "var(--auth-border)", backgroundColor: "var(--auth-card-bg)" }}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: "var(--auth-tint-1)", color: "var(--auth-accent)" }}
      >
        <Icon className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold" style={{ color: "var(--auth-text-primary)" }}>
            {label}
          </span>
          {session.isCurrent && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ backgroundColor: "var(--auth-tint-2)", color: "var(--auth-text-primary)" }}
            >
              This device
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs" style={{ color: "var(--auth-text-muted)" }}>
          Active {formatRelativeTime(session.createdAt)}
        </p>
      </div>

      {session.isCurrent && onLogout && (
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          className="shrink-0 text-xs font-semibold underline-offset-2 outline-none hover:underline focus-visible:underline disabled:opacity-60"
          style={{ color: "var(--auth-text-muted)" }}
        >
          {loggingOut ? "Logging out…" : "Log out"}
        </button>
      )}
    </div>
  );
}
