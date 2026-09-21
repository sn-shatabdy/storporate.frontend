"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import { applyToJob, listMyApplications } from "@/lib/api/jobApplications";
import type { JobApplicationRef } from "@/lib/api/jobPostings";
import { Button } from "@/components/ui/button";

import { ApplicationStatusPill } from "./job-pills";

/** Shown near the Apply button. Short and neutral on purpose. */
export const APPLY_NOTE =
  "Your application shares your profile skills with this employer. Your original files stay private unless you shared them.";

/**
 * Copy from the approved design canvas (`Desktop-03-States.dc.html`,
 * "Apply panel — deadline passed" card). Used when the backend rejects an
 * apply attempt with `job_posting_deadline_passed` so the student gets a
 * specific message instead of the generic fallback.
 */
const DEADLINE_PASSED_MESSAGE =
  "The deadline for this opening has passed. It's no longer accepting applications.";

type Phase = "idle" | "busy";

/**
 * One-action apply for a student. The profile is the application, so the
 * only extra input is a name, asked for only when the student has none on
 * their profile (`application_display_name_required`).
 */
export function ApplyPanel({
  jobId,
  initial,
}: {
  jobId: string;
  initial: JobApplicationRef | null;
}) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [application, setApplication] = useState<JobApplicationRef | null>(
    initial,
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [deadlinePassed, setDeadlinePassed] = useState(false);
  const [needsName, setNeedsName] = useState(false);
  const [name, setName] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const helperId = useId();

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!accessToken || phase === "busy") return;
    if (needsName && name.trim().length === 0) {
      setError("Enter your name to apply.");
      nameRef.current?.focus();
      return;
    }
    setPhase("busy");
    setError(null);
    try {
      const created = await applyToJob(
        accessToken,
        jobId,
        needsName ? name.trim() : undefined,
      );
      setApplication({ id: created.id, status: created.status });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.errorCode === "application_already_submitted") {
          // Already applied elsewhere: show the applied state, using the
          // real status when it can be looked up.
          let current: JobApplicationRef = { id: "", status: "Submitted" };
          try {
            const mine = await listMyApplications(accessToken);
            const found = mine.items.find((a) => a.jobPostingId === jobId);
            if (found) current = { id: found.id, status: found.status };
          } catch {
            // Keep the fallback.
          }
          setApplication(current);
          setPhase("idle");
          return;
        }
        if (e.errorCode === "application_display_name_required") {
          setNeedsName(true);
          setPhase("idle");
          requestAnimationFrame(() => nameRef.current?.focus());
          return;
        }
        if (e.errorCode === "application_display_name_invalid") {
          setNeedsName(true);
          setError("That name is not valid. Check it and try again.");
          setPhase("idle");
          return;
        }
        if (e.errorCode === "job_posting_not_found") {
          setError("This opening is no longer available.");
          setPhase("idle");
          return;
        }
        if (e.errorCode === "job_posting_deadline_passed") {
          // The opening closed between page load and click — surface the
          // deadline-passed callout and a disabled "Applications closed"
          // button so the student knows why the action stopped working.
          setDeadlinePassed(true);
          setPhase("idle");
          return;
        }
      }
      setError("Could not send your application. Try again.");
    }
    setPhase("idle");
  }

  if (application) {
    return (
      <div
        className="flex flex-col gap-2 border-t pt-4"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <CheckCircle2 className="size-4 text-success" aria-hidden />
            You applied
          </span>
          <ApplicationStatusPill status={application.status} />
          <Link
            href="/dashboard/applications"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            View your applications
          </Link>
        </div>
      </div>
    );
  }

  if (deadlinePassed) {
    return (
      <div
        className="flex flex-col gap-3 border-t pt-4"
        style={{ borderColor: "var(--border)" }}
        role="status"
      >
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[10px] bg-warning-soft px-3.5 py-3 text-[14px] font-semibold leading-snug text-warning"
        >
          <AlertTriangle className="size-[18px] shrink-0" aria-hidden />
          <span>{DEADLINE_PASSED_MESSAGE}</span>
        </div>
        <Button
          type="button"
          disabled
          className="h-12 w-full border-0 bg-secondary px-4 text-[15px] font-bold text-muted-foreground sm:h-[48px] sm:w-auto"
        >
          Applications closed
        </Button>
      </div>
    );
  }

  const busy = phase === "busy";

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-3 border-t pt-4"
      style={{ borderColor: "var(--border)" }}
      aria-busy={busy}
    >
      {needsName ? (
        <div className="flex max-w-sm flex-col gap-1.5">
          <label
            htmlFor={nameId}
            className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Your name
          </label>
          <input
            id={nameId}
            ref={nameRef}
            type="text"
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            aria-describedby={helperId}
            className="h-10 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
          />
          <p id={helperId} className="text-xs text-muted-foreground">
            Employers see this name on your application.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button
          type="submit"
          size="lg"
          disabled={busy}
          className="h-10 w-full px-5 text-sm sm:h-9 sm:w-auto"
        >
          {busy ? (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <Send className="size-4" aria-hidden />
          )}
          {busy ? "Applying…" : "Apply"}
        </Button>
        <p className="text-xs leading-5 text-muted-foreground sm:max-w-md">
          {APPLY_NOTE}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}