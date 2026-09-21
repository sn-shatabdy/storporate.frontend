"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, MessageSquarePlus, Trash2 } from "lucide-react";

import type { ConversationDetail, ShortlistEntry } from "@/lib/api/outreach";
import { composeDetailLine, initialsFor } from "@/components/talent/helpers";

import { formatShortDate } from "./helpers";
import { InviteDialog } from "./invite-dialog";
import { ConversationStatusPill } from "./status-pill";

const BUTTON =
  "inline-flex h-9 items-center gap-2 rounded-[10px] border bg-white px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

export interface ShortlistCardProps {
  entry: ShortlistEntry;
  removing: boolean;
  error: string | null;
  onRemove: () => void;
  onInvited: (conversation: ConversationDetail) => void;
}

/** One saved student on the shortlist page. */
export function ShortlistCard({
  entry,
  removing,
  error,
  onRemove,
  onInvited,
}: ShortlistCardProps) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const saved = formatShortDate(entry.savedAt);

  const removeButton = (
    <button
      type="button"
      onClick={onRemove}
      disabled={removing}
      className={`${BUTTON} text-muted-foreground`}
      style={{ borderColor: "#e7dfc0" }}
    >
      {removing ? (
        <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <Trash2 className="size-4" aria-hidden />
      )}
      Remove
    </button>
  );

  if (!entry.available) {
    return (
      <article
        className="flex flex-col gap-3 rounded-2xl border bg-secondary/60 p-5"
        style={{ borderColor: "var(--border)" }}
        aria-label="Unavailable student"
      >
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted font-heading text-base font-semibold text-muted-foreground"
          >
            ?
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">
            This student is no longer available.
          </p>
          {removeButton}
        </div>
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </article>
    );
  }

  const name = entry.displayName ?? "Student";
  const detail = composeDetailLine({
    university: entry.university,
    fieldOfStudy: entry.fieldOfStudy,
    studyYear: entry.studyYear,
  });
  const headline = entry.headline?.trim() ?? "";
  const meta = [...detail.parts, saved ? `Saved ${saved}` : ""]
    .filter(Boolean)
    .join(" · ");
  const conversation = entry.conversation;

  return (
    <article
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
      style={{ borderColor: "var(--border)" }}
      aria-label={`Shortlisted: ${name}`}
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-base font-semibold text-primary"
        >
          {initialsFor(name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <h2 className="min-w-0 break-words font-heading text-lg font-semibold leading-snug text-foreground">
              {name}
            </h2>
            {conversation ? (
              <ConversationStatusPill status={conversation.status} />
            ) : null}
          </div>
          {headline ? (
            <p className="mt-0.5 break-words text-sm text-foreground">{headline}</p>
          ) : null}
          {meta ? (
            <p className="mt-0.5 break-words text-xs text-muted-foreground">{meta}</p>
          ) : null}
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-2 border-t pt-4"
        style={{ borderColor: "var(--border)" }}
      >
        <Link
          href={`/employer/candidates/${encodeURIComponent(entry.candidateId)}`}
          className={BUTTON}
          style={{ borderColor: "#e7dfc0" }}
        >
          View portfolio
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        {conversation ? (
          <Link
            href={`/employer/messages/${encodeURIComponent(conversation.id)}`}
            className={BUTTON}
            style={{ borderColor: "#e7dfc0" }}
          >
            Open conversation
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className={BUTTON}
            style={{ borderColor: "#e7dfc0" }}
          >
            <MessageSquarePlus className="size-4" aria-hidden />
            Invite
          </button>
        )}
        <span className="sm:ml-auto">{removeButton}</span>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}

      {inviteOpen ? (
        <InviteDialog
          candidateId={entry.candidateId}
          candidateName={entry.displayName}
          onClose={() => setInviteOpen(false)}
          onSent={(conversation) => {
            setInviteOpen(false);
            onInvited(conversation);
          }}
        />
      ) : null}
    </article>
  );
}
