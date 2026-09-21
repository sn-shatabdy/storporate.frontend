"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bookmark, BookmarkCheck, Loader2, MessageSquarePlus } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  addToShortlist,
  removeFromShortlist,
  type ConversationDetail,
} from "@/lib/api/outreach";

import { InviteDialog } from "./invite-dialog";

const ACTION_BUTTON =
  "inline-flex h-9 items-center gap-2 rounded-[10px] border bg-white px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";

export interface CandidateActionsProps {
  candidateId: string;
  displayName?: string | null;
  /** Extra controls placed at the end of the button row, such as a link. */
  children?: ReactNode;
  /** Where the row sits on wide screens. */
  align?: "start" | "end";
  className?: string;
}

/**
 * Save to shortlist and Invite for one student. Used on the search result
 * card and the candidate page. State is local once a call succeeds.
 */
export function CandidateActions({
  candidateId,
  displayName,
  children,
  align = "end",
  className,
}: CandidateActionsProps) {
  const end = align === "end";
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [hasConversation, setHasConversation] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (sent) statusRef.current?.focus();
  }, [sent]);

  async function save() {
    if (!accessToken || busy) return;
    setBusy(true);
    setError(null);
    try {
      const entry = await addToShortlist(accessToken, candidateId);
      setSaved(true);
      if (entry?.conversation) {
        setConversationId(entry.conversation.id);
        setHasConversation(true);
      }
    } catch (e) {
      setError(
        e instanceof ApiError && e.errorCode === "candidate_not_found"
          ? "This student is no longer available."
          : "Could not save to your shortlist. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!accessToken || busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeFromShortlist(accessToken, candidateId);
      setSaved(false);
    } catch {
      setError("Could not remove from your shortlist. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleSent(conversation: ConversationDetail) {
    setConversationId(conversation.id);
    setHasConversation(true);
    setSent(true);
    setInviteOpen(false);
  }

  const conversationHref = conversationId
    ? `/employer/messages/${encodeURIComponent(conversationId)}`
    : "/employer/messages";

  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ""}`}>
      <div className={`flex flex-wrap items-center gap-2 ${end ? "sm:justify-end" : ""}`}>
        {saved ? (
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-flex h-9 items-center gap-2 rounded-[10px] border bg-[#e6f4ea] px-3.5 text-sm font-semibold text-[#1e7b34]"
              style={{ borderColor: "rgba(30,123,52,0.35)" }}
            >
              <BookmarkCheck className="size-4" aria-hidden />
              Saved
            </span>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              aria-label="Remove from shortlist"
              className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-2.5 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
            >
              {busy ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : null}
              Remove
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={busy || !accessToken}
            className={ACTION_BUTTON}
            style={{ borderColor: "#e7dfc0" }}
          >
            {busy ? (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : (
              <Bookmark className="size-4" aria-hidden />
            )}
            Save to shortlist
          </button>
        )}

        {sent ? null : hasConversation ? (
          <Link
            href={conversationHref}
            className={ACTION_BUTTON}
            style={{ borderColor: "#e7dfc0" }}
          >
            Open conversation
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className={ACTION_BUTTON}
            style={{ borderColor: "#e7dfc0" }}
          >
            <MessageSquarePlus className="size-4" aria-hidden />
            Invite
          </button>
        )}

        {children}
      </div>

      {sent ? (
        <p
          ref={statusRef}
          tabIndex={-1}
          role="status"
          className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-[#1e7b34] outline-none ${end ? "sm:justify-end" : ""}`}
        >
          <span>Invitation sent.</span>
          <Link
            href={conversationHref}
            className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            Open the conversation
          </Link>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className={`text-sm font-medium text-destructive ${end ? "sm:text-right" : ""}`}>
          {error}
        </p>
      ) : null}

      {inviteOpen ? (
        <InviteDialog
          candidateId={candidateId}
          candidateName={displayName}
          conversationId={conversationId}
          onClose={() => setInviteOpen(false)}
          onSent={handleSent}
        />
      ) : null}
    </div>
  );
}
