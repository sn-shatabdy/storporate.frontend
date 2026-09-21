"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

import { REQUEST_LIMITS, type CompleteRequestInput } from "@/lib/api/sponsorshipRequests";
import { Button } from "@/components/ui/button";

import {
  messageForRequestError,
  parseAmount,
  validateCompletion,
  type RequestErrorAction,
} from "./request-helpers";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';
const LABEL = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const FIELD_ERROR = "text-xs font-medium text-[#B3261E]";
const TEXTAREA =
  "block min-h-[110px] w-full resize-y rounded-xl border bg-white px-3.5 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-[0.55] aria-invalid:border-[#b3261e]";

/**
 * Accessible modal frame used by the three request actions. Escape and the
 * backdrop close it, Tab stays inside, and focus returns to whatever had it
 * before the dialog opened.
 */
function DialogFrame({
  title,
  description,
  titleId,
  busy,
  onClose,
  onSubmit,
  submitLabel,
  busyLabel,
  destructive = false,
  error,
  children,
}: {
  title: string;
  description: string;
  titleId: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  submitLabel: string;
  busyLabel: string;
  destructive?: boolean;
  error: string | null;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("textarea, input")?.focus();
    return () => {
      if (previous && previous.isConnected) previous.focus();
    };
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
            <h2 id={titleId} className="font-heading text-xl font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
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

        <form onSubmit={onSubmit} noValidate aria-busy={busy} className="mt-5 flex flex-col gap-4">
          {children}
          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
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
            <Button
              type="submit"
              size="lg"
              variant={destructive ? "destructive" : "default"}
              className="h-10 sm:h-9"
              disabled={busy}
            >
              {busy ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
              ) : null}
              {busy ? busyLabel : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function CountedTextarea({
  id,
  label,
  value,
  max,
  error,
  disabled,
  optional,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  error?: string;
  disabled: boolean;
  optional?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const over = value.length > max;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
        {optional ? " (optional)" : ""}
      </label>
      <textarea
        id={id}
        rows={4}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={error || over ? true : undefined}
        aria-describedby={error ? `${id}-error ${id}-count` : `${id}-count`}
        onChange={(e) => onChange(e.target.value)}
        className={TEXTAREA}
        style={{ borderColor: "#e7dfc0" }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {error ? (
            <p id={`${id}-error`} className={FIELD_ERROR}>
              {error}
            </p>
          ) : null}
        </div>
        <span
          id={`${id}-count`}
          className={`shrink-0 text-xs ${over ? "font-medium text-destructive" : "text-muted-foreground"}`}
        >
          {value.length} of {max.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}

/** Shared busy and error handling for a dialog that saves one thing. */
function useDialogSave(action: RequestErrorAction, onClose: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  async function run(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await work();
      busyRef.current = false;
      onClose();
      return;
    } catch (e) {
      setError(messageForRequestError(e, action));
    }
    busyRef.current = false;
    setBusy(false);
  }
  return { busy, error, run };
}

export interface NoteDialogProps {
  onClose: () => void;
  /** Throws when the server refuses. The dialog shows the message. */
  onSubmit: (text: string) => Promise<void>;
}

/** Company: accept a request, with an optional note. */
export function AcceptDialog({ onClose, onSubmit }: NoteDialogProps) {
  const [note, setNote] = useState("");
  const titleId = useId();
  const fieldId = useId();
  const { busy, error, run } = useDialogSave("accept", onClose);
  const tooLong = note.trim().length > REQUEST_LIMITS.noteMax;

  return (
    <DialogFrame
      title="Accept this request"
      description="The club sees your note and the status changes to Agreed."
      titleId={titleId}
      busy={busy}
      onClose={onClose}
      submitLabel="Accept request"
      busyLabel="Accepting…"
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        if (tooLong) return;
        void run(() => onSubmit(note.trim()));
      }}
    >
      <CountedTextarea
        id={fieldId}
        label="Note for the club"
        optional
        value={note}
        max={REQUEST_LIMITS.noteMax}
        disabled={busy}
        error={tooLong ? `Use ${REQUEST_LIMITS.noteMax.toLocaleString("en-US")} characters or fewer.` : undefined}
        placeholder="Next steps, contacts or conditions"
        onChange={setNote}
      />
    </DialogFrame>
  );
}

/** Company: decline a request, with an optional reason. */
export function DeclineDialog({ onClose, onSubmit }: NoteDialogProps) {
  const [reason, setReason] = useState("");
  const titleId = useId();
  const fieldId = useId();
  const { busy, error, run } = useDialogSave("decline", onClose);
  const tooLong = reason.trim().length > REQUEST_LIMITS.noteMax;

  return (
    <DialogFrame
      title="Decline this request"
      description="The club sees your reason. You cannot undo this."
      titleId={titleId}
      busy={busy}
      onClose={onClose}
      submitLabel="Decline request"
      busyLabel="Declining…"
      destructive
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        if (tooLong) return;
        void run(() => onSubmit(reason.trim()));
      }}
    >
      <CountedTextarea
        id={fieldId}
        label="Reason for the club"
        optional
        value={reason}
        max={REQUEST_LIMITS.noteMax}
        disabled={busy}
        error={tooLong ? `Use ${REQUEST_LIMITS.noteMax.toLocaleString("en-US")} characters or fewer.` : undefined}
        placeholder="Why this is not a fit right now"
        onChange={setReason}
      />
    </DialogFrame>
  );
}

export interface CompleteDialogProps {
  onClose: () => void;
  onSubmit: (input: CompleteRequestInput) => Promise<void>;
}

/** Either side: mark an agreed request completed with an outcome note. */
export function CompleteDialog({ onClose, onSubmit }: CompleteDialogProps) {
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ note?: string; amount?: string }>({});
  const titleId = useId();
  const noteId = useId();
  const amountId = useId();
  const { busy, error, run } = useDialogSave("complete", onClose);

  return (
    <DialogFrame
      title="Mark as completed"
      description="Say how it went. Both sides see the outcome."
      titleId={titleId}
      busy={busy}
      onClose={onClose}
      submitLabel="Mark as completed"
      busyLabel="Saving…"
      error={error}
      onSubmit={(e) => {
        e.preventDefault();
        const found = validateCompletion(note, amount);
        setErrors(found);
        if (found.note) {
          document.getElementById(noteId)?.focus();
          return;
        }
        if (found.amount) {
          document.getElementById(amountId)?.focus();
          return;
        }
        void run(() =>
          onSubmit({ outcomeNote: note.trim(), agreedAmount: parseAmount(amount) }),
        );
      }}
    >
      <CountedTextarea
        id={noteId}
        label="Outcome note"
        value={note}
        max={REQUEST_LIMITS.outcomeNoteMax}
        disabled={busy}
        error={errors.note}
        placeholder="What happened and what was delivered"
        onChange={setNote}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={amountId} className={LABEL}>
          Final amount in BDT (optional)
        </label>
        <input
          id={amountId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={amount}
          disabled={busy}
          aria-invalid={errors.amount ? true : undefined}
          aria-describedby={errors.amount ? `${amountId}-error` : undefined}
          onChange={(e) => setAmount(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60 aria-invalid:border-[#b3261e]"
        />
        {errors.amount ? (
          <p id={`${amountId}-error`} className={FIELD_ERROR}>
            {errors.amount}
          </p>
        ) : null}
      </div>
    </DialogFrame>
  );
}
