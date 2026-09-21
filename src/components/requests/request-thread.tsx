"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";

import { REQUEST_LIMITS, type RequestMessage } from "@/lib/api/sponsorshipRequests";
import { Button } from "@/components/ui/button";
import { formatMessageTime } from "@/components/outreach/helpers";

export type RequestSide = "Club" | "Company";

export interface RequestThreadProps {
  /** Which side is reading. Their own messages sit on the right. */
  viewer: RequestSide;
  messages: RequestMessage[];
  clubName: string;
  companyName: string;
  /** True only when the server allows a message. */
  canMessage: boolean;
  sending: boolean;
  /** Inline error shown under the composer. */
  error: string | null;
  /** Resolves true when the message was sent so the draft can clear. */
  onSend: (body: string) => Promise<boolean>;
  /** Label for the composer button and field. */
  composerLabel?: string;
  placeholder?: string;
}

/** The conversation on one request, used by both sides. */
export function RequestThread({
  viewer,
  messages,
  clubName,
  companyName,
  canMessage,
  sending,
  error,
  onSend,
  composerLabel = "Send",
  placeholder = "Write a message",
}: RequestThreadProps) {
  const listRef = useRef<HTMLUListElement>(null);
  const count = messages.length;
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  return (
    <section
      aria-labelledby="request-thread-title"
      className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm"
      style={{ borderColor: "var(--border)" }}
    >
      <header
        className="border-b px-4 py-4 sm:px-6"
        style={{ borderColor: "var(--border)" }}
      >
        <h2
          id="request-thread-title"
          className="font-heading text-lg font-semibold text-foreground"
        >
          Conversation
        </h2>
      </header>

      {messages.length === 0 ? (
        <p className="bg-[#fffdf6] px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
          No messages yet.
        </p>
      ) : (
        <ul
          ref={listRef}
          role="log"
          aria-label="Messages"
          className="flex max-h-[55vh] min-h-[120px] flex-col gap-4 overflow-y-auto bg-[#fffdf6] px-4 py-5 sm:px-6"
        >
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine={message.from === viewer}
              senderName={message.from === "Club" ? clubName : companyName}
            />
          ))}
        </ul>
      )}

      {canMessage || error ? (
        <div
          className="flex flex-col gap-3 border-t px-4 py-4 sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          {canMessage ? (
            <Composer
              label={composerLabel}
              placeholder={placeholder}
              sending={sending}
              onSend={onSend}
            />
          ) : null}
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p
          className="border-t px-4 py-3 text-sm text-muted-foreground sm:px-6"
          style={{ borderColor: "var(--border)" }}
        >
          Messages are closed for this request.
        </p>
      )}
    </section>
  );
}

function MessageBubble({
  message,
  mine,
  senderName,
}: {
  message: RequestMessage;
  mine: boolean;
  senderName: string;
}) {
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
        {mine ? "You" : senderName}
        {time ? ` · ${time}` : ""}
      </span>
    </li>
  );
}

function Composer({
  label,
  placeholder,
  sending,
  onSend,
}: {
  label: string;
  placeholder: string;
  sending: boolean;
  onSend: (body: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const id = useId();
  const counterId = useId();
  const length = draft.length;
  const trimmed = draft.trim();
  const tooLong = length > REQUEST_LIMITS.messageMax;
  const canSend = trimmed.length > 0 && !tooLong && !sending;

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
        placeholder={placeholder}
        aria-describedby={counterId}
        disabled={sending}
        className="block min-h-[84px] w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-[0.55]"
        style={{ borderColor: "#e7dfc0" }}
      />
      <div className="flex items-center justify-between gap-3">
        <span
          id={counterId}
          className={`text-xs ${tooLong ? "font-medium text-destructive" : "text-muted-foreground"}`}
        >
          {length} of {REQUEST_LIMITS.messageMax}
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
          {sending ? "Sending…" : label}
        </Button>
      </div>
    </form>
  );
}
