import Link from "next/link";
import { CalendarDays, ChevronRight, MessageSquare, Wallet } from "lucide-react";

import type { RequestSummary } from "@/lib/api/sponsorshipRequests";
import { initialsOf } from "@/components/clubs/club-helpers";

import {
  formatAmount,
  formatDay,
  messageCountText,
} from "./request-helpers";
import { RequestStatusPill } from "./status-pill";

/**
 * One row of a request list. The whole card is the link. On the company side
 * a request that is still Sent carries a "New" badge.
 */
export function RequestCard({
  request,
  href,
  highlightNew = false,
}: {
  request: RequestSummary;
  href: string;
  highlightNew?: boolean;
}) {
  const isNew = highlightNew && request.status === "Sent";
  const amount = formatAmount(request.amountRequested);
  const eventDate = formatDay(request.eventDate);
  const updated = formatDay(request.updatedAt);

  return (
    <article
      data-new={isNew ? "true" : undefined}
      className={`relative flex items-start gap-3.5 rounded-2xl border bg-card p-4 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring/40 hover:bg-[#fffdf6] sm:p-5 ${
        isNew ? "border-border border-l-4 border-l-primary" : ""
      }`}
      style={isNew ? undefined : { borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-base font-semibold text-primary"
      >
        {initialsOf(request.counterpartName)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
          <h2 className="min-w-0 break-words font-heading text-base font-semibold leading-snug text-foreground sm:text-lg">
            <Link
              href={href}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl"
            >
              {request.eventTitle}
            </Link>
          </h2>
          <div className="flex items-center gap-1.5">
            {isNew ? (
              <span className="inline-flex items-center rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">
                New
              </span>
            ) : null}
            <RequestStatusPill status={request.status} />
          </div>
        </div>
        <p className="break-words text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{request.counterpartName}</span>
          {request.goalName ? <span>{` · ${request.goalName}`}</span> : null}
        </p>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {amount ? (
            <li className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Wallet className="size-3.5 text-muted-foreground" aria-hidden />
              {amount}
            </li>
          ) : null}
          {eventDate ? (
            <li className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" aria-hidden />
              Event {eventDate}
            </li>
          ) : null}
          <li className="inline-flex items-center gap-1.5">
            <MessageSquare className="size-3.5" aria-hidden />
            {messageCountText(request.messageCount)}
          </li>
          {updated ? <li>Updated {updated}</li> : null}
        </ul>
      </div>
      <ChevronRight
        className="mt-3 hidden size-4 shrink-0 text-muted-foreground sm:block"
        aria-hidden
      />
    </article>
  );
}
