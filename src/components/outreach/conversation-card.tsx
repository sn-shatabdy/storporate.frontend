import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { ConversationSummary } from "@/lib/api/outreach";
import { initialsFor } from "@/components/talent/helpers";

import { formatShortDate } from "./helpers";
import { ConversationStatusPill } from "./status-pill";

/** One row of a conversation list. The whole card is the link. */
export function ConversationCard({
  conversation,
  href,
}: {
  conversation: ConversationSummary;
  href: string;
}) {
  const when = formatShortDate(conversation.lastMessageAt);
  return (
    <article
      className="relative flex items-start gap-3.5 rounded-2xl border bg-card p-4 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring/40 hover:bg-[#fffdf6] sm:p-5"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-base font-semibold text-primary"
      >
        {initialsFor(conversation.counterpartName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="min-w-0 break-words font-heading text-base font-semibold leading-snug text-foreground sm:text-lg">
            <Link
              href={href}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl"
            >
              {conversation.counterpartName}
            </Link>
          </h2>
          <div className="flex items-center gap-2">
            <ConversationStatusPill status={conversation.status} />
            {when ? (
              <span className="text-xs text-muted-foreground">{when}</span>
            ) : null}
          </div>
        </div>
        <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">
          {conversation.lastMessagePreview}
        </p>
      </div>
      <ChevronRight
        className="mt-3 hidden size-4 shrink-0 text-muted-foreground sm:block"
        aria-hidden
      />
    </article>
  );
}
