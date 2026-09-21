"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Send } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import type { CompanyGoalDetail } from "@/lib/api/sponsorship";
import { REQUEST_LIMITS, type CreateRequestInput } from "@/lib/api/sponsorshipRequests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { initialsOf } from "@/components/clubs/club-helpers";
import { ChipList } from "@/components/sponsorship/sponsorship-pieces";

import {
  EMPTY_REQUEST_VALUES,
  inputFromValues,
  isoDate,
  messageForRequestError,
  REQUEST_ERROR_ORDER,
  REQUEST_FIELD_IDS as IDS,
  validateRequest,
  type RequestFormErrors,
  type RequestFormValues,
} from "./request-helpers";

const LABEL = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const FIELD_ERROR = "text-xs font-medium text-[#B3261E]";
const CARD = "flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6";

type Problem =
  | { kind: "duplicate"; message: string }
  | { kind: "profile"; message: string }
  | { kind: "other"; message: string };

function Field({
  id,
  label,
  optional,
  counter,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  counter?: { length: number; max: number };
  error?: string;
  children: ReactNode;
}) {
  const over = counter ? counter.length > counter.max : false;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
        {optional ? " (optional)" : ""}
      </label>
      {children}
      {error || counter ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {error ? (
              <p id={`${id}-error`} className={FIELD_ERROR}>
                {error}
              </p>
            ) : null}
          </div>
          {counter ? (
            <span
              id={`${id}-count`}
              className={`shrink-0 text-xs ${over ? "font-medium text-destructive" : "text-muted-foreground"}`}
            >
              {counter.length.toLocaleString("en-US")} of {counter.max.toLocaleString("en-US")}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hasCounter: boolean, error?: string) {
  const parts = [hasCounter ? `${id}-count` : null, error ? `${id}-error` : null];
  return parts.filter(Boolean).join(" ") || undefined;
}

/** The company and goal set a request is about, read only. */
export function GoalContextCard({ goal }: { goal: CompanyGoalDetail }) {
  return (
    <section
      aria-label="Who you are asking"
      className={CARD}
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-base font-semibold text-primary"
        >
          {initialsOf(goal.companyName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className={LABEL}>Sending to</p>
          <h2 className="break-words font-heading text-xl font-semibold leading-snug text-foreground">
            {goal.companyName}
          </h2>
          <p className="break-words text-sm text-muted-foreground">{goal.name}</p>
        </div>
      </div>
      {goal.objectives.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className={LABEL}>What they want</p>
          <ChipList items={goal.objectives} label="Objectives" />
        </div>
      ) : null}
      {goal.eventKinds.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className={LABEL}>Events they would back</p>
          <ChipList items={goal.eventKinds} label="Event kinds" tone="neutral" />
        </div>
      ) : null}
    </section>
  );
}

/**
 * The sponsorship request form. Validation runs on submit, the first invalid
 * field gets focus, and a server failure shows in an alert. The page decides
 * what happens after a send.
 */
export function RequestForm({
  goalId,
  cancelHref,
  onSubmit,
  onGoalMissing,
}: {
  goalId: string;
  cancelHref: string;
  /** Throws when the server refuses. */
  onSubmit: (input: CreateRequestInput) => Promise<void>;
  /** Called when the server says the goal set is gone. */
  onGoalMissing: () => void;
}) {
  const [values, setValues] = useState<RequestFormValues>(EMPTY_REQUEST_VALUES);
  const [errors, setErrors] = useState<RequestFormErrors>({});
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const busyRef = useRef(false);
  const problemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (problem) problemRef.current?.focus();
  }, [problem]);

  function set<K extends keyof RequestFormValues>(key: K, value: RequestFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    setProblem(null);

    const found = validateRequest(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = REQUEST_ERROR_ORDER.find((id) => found[id]);
      if (first) document.getElementById(first)?.focus();
      return;
    }

    busyRef.current = true;
    setBusy(true);
    try {
      await onSubmit(inputFromValues(goalId, values));
      setSent(true);
      return;
    } catch (error) {
      const message = messageForRequestError(error, "create");
      if (error instanceof ApiError) {
        if (error.errorCode === "sponsorship_goal_not_found") {
          onGoalMissing();
        } else if (error.errorCode === "sponsorship_request_duplicate") {
          setProblem({ kind: "duplicate", message });
        } else if (
          error.errorCode === "club_profile_not_found" ||
          error.errorCode === "club_profile_not_published"
        ) {
          setProblem({ kind: "profile", message });
        } else {
          setProblem({ kind: "other", message });
        }
      } else {
        setProblem({ kind: "other", message });
      }
    }
    busyRef.current = false;
    setBusy(false);
  }

  const L = REQUEST_LIMITS;
  const statusLine = sent ? "Request sent." : busy ? "Sending…" : "";

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={busy} className="flex flex-col gap-4">
      {problem ? (
        <div
          ref={problemRef}
          tabIndex={-1}
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border bg-[#fbe9e7] p-4 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          style={{ borderColor: "rgba(179,38,30,0.25)" }}
        >
          <p className="flex items-start gap-2 font-medium">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#b3261e]" aria-hidden />
            <span>{problem.message}</span>
          </p>
          {problem.kind === "duplicate" ? (
            <Button asChild variant="outline" size="lg" className="h-10 w-fit bg-white sm:h-9">
              <Link href="/club/requests">See your sent requests</Link>
            </Button>
          ) : null}
          {problem.kind === "profile" ? (
            <Button asChild variant="outline" size="lg" className="h-10 w-fit bg-white sm:h-9">
              <Link href="/club/profile">Go to my club profile</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="request-event-heading" className={CARD} style={{ borderColor: "var(--border)" }}>
        <div>
          <h2 id="request-event-heading" className="font-heading text-lg font-semibold text-foreground">
            The event
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Tell the company what you are planning.</p>
        </div>
        <Field id={IDS.eventTitle} label="Event title" error={errors[IDS.eventTitle]}>
          <Input
            id={IDS.eventTitle}
            value={values.eventTitle}
            disabled={busy}
            aria-invalid={errors[IDS.eventTitle] ? true : undefined}
            aria-describedby={describedBy(IDS.eventTitle, false, errors[IDS.eventTitle])}
            onChange={(e) => set("eventTitle", e.target.value)}
            className="h-10"
          />
        </Field>
        <Field id={IDS.eventDate} label="Event date" optional error={errors[IDS.eventDate]}>
          <Input
            id={IDS.eventDate}
            type="date"
            value={values.eventDate}
            min={isoDate(new Date(), -1)}
            disabled={busy}
            aria-invalid={errors[IDS.eventDate] ? true : undefined}
            aria-describedby={describedBy(IDS.eventDate, false, errors[IDS.eventDate])}
            onChange={(e) => set("eventDate", e.target.value)}
            className="h-10 sm:max-w-[220px]"
          />
        </Field>
        <Field
          id={IDS.eventDescription}
          label="About the event"
          counter={{ length: values.eventDescription.length, max: L.eventDescriptionMax }}
          error={errors[IDS.eventDescription]}
        >
          <Textarea
            id={IDS.eventDescription}
            rows={6}
            value={values.eventDescription}
            disabled={busy}
            aria-invalid={errors[IDS.eventDescription] ? true : undefined}
            aria-describedby={describedBy(IDS.eventDescription, true, errors[IDS.eventDescription])}
            onChange={(e) => set("eventDescription", e.target.value)}
          />
        </Field>
      </section>

      <section aria-labelledby="request-ask-heading" className={CARD} style={{ borderColor: "var(--border)" }}>
        <div>
          <h2 id="request-ask-heading" className="font-heading text-lg font-semibold text-foreground">
            The sponsorship
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Say what you need and what the company gets back.
          </p>
        </div>
        <Field
          id={IDS.ask}
          label="What you are asking for"
          counter={{ length: values.ask.length, max: L.askMax }}
          error={errors[IDS.ask]}
        >
          <Textarea
            id={IDS.ask}
            rows={4}
            value={values.ask}
            disabled={busy}
            aria-invalid={errors[IDS.ask] ? true : undefined}
            aria-describedby={describedBy(IDS.ask, true, errors[IDS.ask])}
            onChange={(e) => set("ask", e.target.value)}
          />
        </Field>
        <Field
          id={IDS.offer}
          label="What the company gets in return"
          counter={{ length: values.offer.length, max: L.offerMax }}
          error={errors[IDS.offer]}
        >
          <Textarea
            id={IDS.offer}
            rows={4}
            value={values.offer}
            disabled={busy}
            aria-invalid={errors[IDS.offer] ? true : undefined}
            aria-describedby={describedBy(IDS.offer, true, errors[IDS.offer])}
            onChange={(e) => set("offer", e.target.value)}
          />
        </Field>
        <Field
          id={IDS.amount}
          label="Amount you are asking for (BDT)"
          optional
          error={errors[IDS.amount]}
        >
          <Input
            id={IDS.amount}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={values.amount}
            disabled={busy}
            aria-invalid={errors[IDS.amount] ? true : undefined}
            aria-describedby={describedBy(IDS.amount, false, errors[IDS.amount])}
            onChange={(e) => set("amount", e.target.value)}
            className="h-10 sm:max-w-[220px]"
          />
        </Field>
      </section>

      <div
        className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-md backdrop-blur"
        style={{ borderColor: "var(--border)" }}
      >
        <p
          role="status"
          aria-live="polite"
          className="min-w-0 flex-1 px-1 text-sm text-muted-foreground"
        >
          {statusLine}
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="lg" className="h-10 sm:h-9">
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button type="submit" size="lg" disabled={busy || sent} className="h-10 px-5 sm:h-9">
            {busy ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            Send request
          </Button>
        </div>
      </div>
    </form>
  );
}
