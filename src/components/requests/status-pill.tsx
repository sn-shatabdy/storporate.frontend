import { CheckCircle2 } from "lucide-react";

import type { RequestStatus } from "@/lib/api/sponsorshipRequests";

import { statusLabel } from "./request-helpers";

const PILL =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold";

const STYLES: Record<RequestStatus, { bg: string; fg: string }> = {
  Sent: { bg: "#f3efdd", fg: "#2a1830" },
  Viewed: { bg: "#f3efdd", fg: "#2a1830" },
  InDiscussion: { bg: "#e7f0ed", fg: "#345a73" },
  Agreed: { bg: "#e6f4ea", fg: "#1e7b34" },
  Declined: { bg: "#fbeee7", fg: "#a4460f" },
  Completed: { bg: "#2a1830", fg: "#fbf8ec" },
};

/** Where a sponsorship request stands. Always text, never colour alone. */
export function RequestStatusPill({ status }: { status: RequestStatus }) {
  const s = STYLES[status] ?? STYLES.Sent;
  return (
    <span
      className={PILL}
      data-status={status}
      style={{ backgroundColor: s.bg, color: s.fg }}
    >
      {status === "Completed" ? <CheckCircle2 className="size-3" aria-hidden /> : null}
      {statusLabel(status)}
    </span>
  );
}
