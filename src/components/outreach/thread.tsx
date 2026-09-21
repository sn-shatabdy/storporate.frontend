"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Send } from "lucide-react";

import {
  OUTREACH_MESSAGE_MAX,
  type ConversationDetail,
  type ConversationMessage,
} from "@/lib/api/outreach";
import { Button } from "@/components/ui/button";
import { initialsFor } from "@/components/talent/helpers";

import { formatMessageTime } from "./helpers";
import { ConversationStatusPill } from "./status-pill";

export type ThreadRole = "employer" | "student";

export const STUDENT_PRIVACY_LINE =
  "The organization cannot see your email or contact details.";
export const EMPLOYER_WAITING_LINE = "Waiting for the student to reply.";
export const EMPLOYER_DECLINED_LINE =
  "This student declined. You cannot send more messages.";
export const STUDENT_DECLINED_LINE = "You declined this invitation.";

export interface ConversationThreadProps {
  role: ThreadRole;
  conversation: ConversationDetail;
  backHref: string;
  backLabel: string;
  /** True while a message is being sent. */
  sending: boolean;
  /** True while a decline is being saved (student only). */
  declining?: boolean;
  /** Inline error shown under the composer. */
  error: string | null;
  /** Resolves true when the message was sent so the draft can clear. */
  onSend: (message: string) => Promise<boolean>;
  /** Student only. Called after the inline confirm step. */
  onDecline?: () => void;
}

/**
 * One conversation, used by both sides. It owns the rules:
 *  - Invited: the employer waits (no composer), the student can reply or
 *    decline.
 *  - Replied: both can write. The student can still decline.
 *  - Declined: read only for both.
 */
export function ConversationThread({
  role,
  conversation,
  backHref,
  backLabel,
  sending,
  declining = false,
  error,
  onSend,
  onDecline,
}: ConversationThreadProps) {
  const { status } = conversation;
  const isEmployer = role === "employer";
  const canCompose = isEmployer ? status === "Replied" : status !== "Declined";
  const canDecline = !isEmployer && status !== "Declined" && !!onDecline;

  const listRef = useRef<HTMLUListElement>(null);
  const count = conversation.messages.length;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>

      <section
        className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm"
        style={{ borderColor: "var(--border)" }}
        aria-label="Conversation"
      >
        <header
          className="flex flex-col gap-2 border-b px-4 py-4 sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-base font-semibold text-primary"
            >
              {initialsFor(conversation.counterpartName)}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <h1 className="min-w-0 break-words font-heading text-xl font-semibold leading-snug text-foreground sm:text-2xl">
                {conversation.counterpartName}
              </h1>
              <ConversationStatusPill status={status} />
            </div>
          </div>
          {!isEmployer ? (
            <p className="text-xs text-muted-foreground">{STUDENT_PRIVACY_LINE}</p>
          ) : null}
        </header>

        <ul
          ref={listRef}
          role="log"
          aria-label="Messages"
          className="flex max-h-[55vh] min-h-[160px] flex-col gap-4 overflow-y-auto bg-[#fffdf6] px-4 py-5 sm:px-6"
        >
          {conversation.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              counterpartName={conversation.counterpartName}
            />
          ))}
        </ul>

        <div
          className="flex flex-col gap-3 border-t px-4 py-4 sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          {isEmployer && status === "Invited" ? (
            <Notice>{EMPLOYER_WAITING_LINE}</Notice>
          ) : null}
          {isEmployer && status === "Declined" ? (
            <Notice>{EMPLOYER_DECLINED_LINE}</Notice>
          ) : null}
          {!isEmployer && status === "Declined" ? (
            <Notice>{STUDENT_DECLINED_LINE}</Notice>
          ) : null}

          {canCompose ? (
            <Composer
              sendLabel={!isEmployer && status === "Invited" ? "Send reply" : "Send"}
              sending={sending}
              disabled={declining}
              onSend={onSend}
            />
          ) : null}

          {canDecline ? (
            <DeclineControl
              declining={declining}
              disabled={sending}
              onConfirm={onDecline}
            />
          ) : null}

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-xl bg-secondary px-4 py-3 text-sm text-muted-foreground"
    >
      {children}
    </p>
  );
}

function MessageBubble({
  message,
  counterpartName,
}: {
  message: ConversationMessage;
  counterpartName: string;
}) {
  const mine = message.fromMe;
  const time = formatMessageTime(message.createdAt);
  return (
    <li
      data-from={mine ? "me" : "them"}
      className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}
    >
      <p
        className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%] ${
          mine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border bg-white text-foreground"
        }`}
        style={mine ? undefined : { borderColor: "var(--border)" }}
      >
        {message.body}
      </p>
      <span className="px-1 text-[11px] text-muted-foreground">
        {mine ? "You" : counterpartName}
        {time ? ` · ${time}` : ""}
      </span>
    </li>
  );
}

function Composer({
  sendLabel,
  sending,
  disabled,
  onSend,
}: {
  sendLabel: string;
  sending: boolean;
  disabled: boolean;
  onSend: (message: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const counterId = useId();
  const length = draft.length;
  const trimmed = draft.trim();
  const tooLong = length > OUTREACH_MESSAGE_MAX;
  const canSend = trimmed.length > 0 && !tooLong && !sending && !disabled;

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!canSend) return;
    const ok = await onSend(trimmed);
    if (ok) setDraft("");
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2" aria-busy={sending}>
      <label htmlFor={id} className="sr-only">
        Message
      </label>
      <textarea
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
        }}
        rows={3}
        placeholder="Write a message"
        aria-describedby={counterId}
        disabled={sending || disabled}
        className="block min-h-[84px] w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-[0.55]"
        style={{ borderColor: "#e7dfc0" }}
      />
      <div className="flex items-center justify-between gap-3">
        <span
          id={counterId}
          className={`text-xs ${tooLong ? "font-medium text-destructive" : "text-muted-foreground"}`}
        >
          {length} of {OUTREACH_MESSAGE_MAX}
        </span>
        <Button type="submit" size="lg" disabled={!canSend} className="h-10 px-4 sm:h-9">
          {sending ? (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          {sending ? "Sending…" : sendLabel}
        </Button>
      </div>
    </form>
  );
}

function DeclineControl({
  declining,
  disabled,
  onConfirm,
}: {
  declining: boolean;
  disabled: boolean;
  onConfirm?: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <div
        className="flex border-t pt-3"
        style={{ borderColor: "var(--border)" }}
      >
        <Button
          ref={triggerRef}
          type="button"
          variant="outline"
          size="lg"
          className="h-9"
          disabled={disabled}
          onClick={() => setConfirming(true)}
        >
          Decline
        </Button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label="Confirm decline"
      className="flex flex-col gap-3 rounded-xl border bg-[#fbeee7] p-4"
      style={{ borderColor: "rgba(164,70,15,0.25)" }}
    >
      <p className="text-sm font-medium text-[#a4460f]">
        Decline this invitation? This is final. You cannot undo it.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          ref={confirmRef}
          type="button"
          variant="destructive"
          size="lg"
          className="h-9"
          disabled={declining}
          onClick={onConfirm}
        >
          {declining ? (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : null}
          {declining ? "Declining…" : "Yes, decline"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-9"
          disabled={declining}
          onClick={() => {
            setConfirming(false);
            requestAnimationFrame(() => triggerRef.current?.focus());
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
