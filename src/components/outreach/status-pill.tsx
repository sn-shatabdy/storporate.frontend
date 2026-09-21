import type { ConversationStatus } from "@/lib/api/outreach";

const PILL =
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold";

const STYLES: Record<ConversationStatus, { bg: string; fg: string }> = {
  Invited: { bg: "#e7f0ed", fg: "#345a73" },
  Replied: { bg: "#e6f4ea", fg: "#1e7b34" },
  Declined: { bg: "#fbeee7", fg: "#a4460f" },
};

/** Where a conversation stands: Invited, Replied or Declined. */
export function ConversationStatusPill({
  status,
}: {
  status: ConversationStatus;
}) {
  const s = STYLES[status] ?? STYLES.Invited;
  return (
    <span className={PILL} style={{ backgroundColor: s.bg, color: s.fg }}>
      {status}
    </span>
  );
}
