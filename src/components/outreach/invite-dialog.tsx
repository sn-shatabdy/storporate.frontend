"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, Send, X } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  OUTREACH_MESSAGE_MAX,
  OUTREACH_ORGANIZATION_MAX,
  OUTREACH_ORGANIZATION_MIN,
  startOutreach,
  type ConversationDetail,
} from "@/lib/api/outreach";
import { Button } from "@/components/ui/button";

import { readRememberedOrganization, rememberOrganization } from "./helpers";

const ORG_ERROR = `Enter your organization, ${OUTREACH_ORGANIZATION_MIN} to ${OUTREACH_ORGANIZATION_MAX} characters.`;
const MESSAGE_EMPTY_ERROR = "Write a message before you send.";
const MESSAGE_LONG_ERROR = `Use ${OUTREACH_MESSAGE_MAX} characters or fewer.`;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface InviteDialogProps {
  candidateId: string;
  /** Shown in the title when known. */
  candidateName?: string | null;
  /** Conversation id when one is already known, for the 409 link. */
  conversationId?: string | null;
  onClose: () => void;
  onSent: (conversation: ConversationDetail) => void;
}

/**
 * Accessible modal for the first message to a student. Escape and the
 * backdrop close it, Tab stays inside, and focus returns to whatever had it
 * before the dialog opened.
 */
export function InviteDialog({
  candidateId,
  candidateName,
  conversationId = null,
  onClose,
  onSent,
}: InviteDialogProps) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [organization, setOrganization] = useState(readRememberedOrganization);
  const [message, setMessage] = useState("");
  const [orgError, setOrgError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [alreadyStarted, setAlreadyStarted] = useState(false);
  const [busy, setBusy] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const orgRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const orgId = useId();
  const messageId = useId();
  const counterId = useId();

  // Focus the first empty field, and give focus back on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    (organization.trim() ? messageRef.current : orgRef.current)?.focus();
    return () => {
      if (previous && previous.isConnected) previous.focus();
    };
    // Runs once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (!nodes || nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !accessToken) return;
    const org = organization.trim();
    const body = message.trim();
    let invalid = false;
    if (org.length < OUTREACH_ORGANIZATION_MIN || org.length > OUTREACH_ORGANIZATION_MAX) {
      setOrgError(ORG_ERROR);
      invalid = true;
    } else {
      setOrgError(null);
    }
    if (body.length === 0) {
      setMessageError(MESSAGE_EMPTY_ERROR);
      invalid = true;
    } else if (message.length > OUTREACH_MESSAGE_MAX) {
      setMessageError(MESSAGE_LONG_ERROR);
      invalid = true;
    } else {
      setMessageError(null);
    }
    if (invalid) {
      if (org.length < OUTREACH_ORGANIZATION_MIN || org.length > OUTREACH_ORGANIZATION_MAX) {
        orgRef.current?.focus();
      } else {
        messageRef.current?.focus();
      }
      return;
    }

    setBusy(true);
    setFormError(null);
    setAlreadyStarted(false);
    try {
      const conversation = await startOutreach(accessToken, {
        candidateId,
        organizationName: org,
        message: body,
      });
      rememberOrganization(org);
      onSent(conversation);
      return;
    } catch (e) {
      if (e instanceof ApiError) {
        switch (e.errorCode) {
          case "outreach_organization_name_invalid":
            setOrgError(ORG_ERROR);
            break;
          case "outreach_message_invalid":
            setMessageError("Write a message of 1 to 2000 characters.");
            break;
          case "outreach_already_started":
            setAlreadyStarted(true);
            setFormError("You already started a conversation with this student.");
            break;
          case "outreach_declined":
            setFormError("This student declined. You cannot send more messages.");
            break;
          case "candidate_not_found":
            setFormError("This student is no longer available.");
            break;
          default:
            setFormError("Could not send the invitation. Try again.");
        }
      } else {
        setFormError("Could not send the invitation. Try again.");
      }
    }
    setBusy(false);
  }

  const conversationHref = conversationId
    ? `/employer/messages/${encodeURIComponent(conversationId)}`
    : "/employer/messages";
  const tooLong = message.length > OUTREACH_MESSAGE_MAX;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(42,24,48,0.45)] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className="flex max-h-[92vh] w-full max-w-[520px] flex-col overflow-y-auto rounded-t-2xl border bg-card p-5 shadow-xl sm:rounded-2xl sm:p-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-heading text-xl font-semibold text-foreground"
            >
              {candidateName ? `Invite ${candidateName}` : "Invite this student"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The student decides whether to reply. Their contact details stay private.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            disabled={busy}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={submit} noValidate aria-busy={busy} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={orgId}
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Your organization
            </label>
            <input
              id={orgId}
              ref={orgRef}
              type="text"
              autoComplete="organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              disabled={busy}
              aria-invalid={orgError ? true : undefined}
              aria-describedby={orgError ? `${orgId}-error` : undefined}
              className="h-10 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
            />
            {orgError ? (
              <p id={`${orgId}-error`} className="text-xs font-medium text-[#B3261E]">
                {orgError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={messageId}
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Message
            </label>
            <textarea
              id={messageId}
              ref={messageRef}
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy}
              aria-invalid={messageError ? true : undefined}
              aria-describedby={
                messageError ? `${counterId} ${messageId}-error` : counterId
              }
              className="block min-h-[120px] w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-[0.55]"
              style={{ borderColor: "#e7dfc0" }}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {messageError ? (
                  <p id={`${messageId}-error`} className="text-xs font-medium text-[#B3261E]">
                    {messageError}
                  </p>
                ) : null}
              </div>
              <span
                id={counterId}
                className={`shrink-0 text-xs ${tooLong ? "font-medium text-destructive" : "text-muted-foreground"}`}
              >
                {message.length} of {OUTREACH_MESSAGE_MAX}
              </span>
            </div>
          </div>

          {formError ? (
            <div role="alert" className="flex flex-col gap-1.5 text-sm font-medium text-destructive">
              <p>{formError}</p>
              {alreadyStarted ? (
                <Link
                  href={conversationHref}
                  className="w-fit font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  Open the conversation
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-10 sm:h-9"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" size="lg" className="h-10 sm:h-9" disabled={busy}>
              {busy ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
