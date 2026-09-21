"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import type { JobPostingRequest } from "@/lib/api/jobPostings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { SegmentedControl } from "./segmented-control";
import { TagInput } from "./tag-input";
import {
  addSkills,
  EMPTY_VALUES,
  FIELD_ORDER,
  LIMITS,
  requestFromValues,
  validatePosting,
  type PostingErrors,
  type PostingField,
  type PostingFormValues,
} from "./posting-helpers";

const LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const FIELD_ERROR = "text-xs font-medium text-[#B3261E]";

/** Turn a save failure into one plain sentence. */
export function messageForPostingError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "job_posting_closed") {
      return "This opening is closed, so it can no longer be changed.";
    }
    if (error.errorCode === "job_posting_not_found") {
      return "This opening could not be found.";
    }
    if (error.status === 400 && error.message) return error.message;
  }
  return "Could not save the opening. Check your connection and try again.";
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className={FIELD_ERROR}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Shared create and edit form for job and internship openings. Validation
 * runs on submit, the first invalid field gets focus, and server errors are
 * mapped to one sentence in a form level alert.
 */
export function PostingForm({
  initialValues = EMPTY_VALUES,
  submitLabel,
  cancelHref,
  onSubmit,
}: {
  initialValues?: PostingFormValues;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (request: JobPostingRequest) => Promise<void>;
}) {
  const [values, setValues] = useState<PostingFormValues>(initialValues);
  const [skillDraft, setSkillDraft] = useState("");
  const [errors, setErrors] = useState<PostingErrors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const refs = useRef<Record<PostingField, HTMLElement | null>>({
    title: null,
    companyName: null,
    location: null,
    description: null,
    requiredSkills: null,
  });

  function set<K extends keyof PostingFormValues>(
    key: K,
    value: PostingFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    if (key in errors) {
      setErrors((e) => {
        const next = { ...e };
        delete next[key as PostingField];
        return next;
      });
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setFormError(null);

    // Take a half typed skill along with the submit.
    const merged = skillDraft.trim()
      ? addSkills(values.requiredSkills, skillDraft).skills
      : values.requiredSkills;
    const finalValues = { ...values, requiredSkills: merged };

    const found = validatePosting(finalValues);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = FIELD_ORDER.find((f) => found[f]);
      if (first) refs.current[first]?.focus();
      return;
    }

    setValues(finalValues);
    setSkillDraft("");
    setBusy(true);
    try {
      await onSubmit(requestFromValues(finalValues));
    } catch (error) {
      setFormError(messageForPostingError(error));
      setBusy(false);
    }
  }

  const descriptionLength = values.description.trim().length;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      style={{ borderColor: "var(--border)" }}
    >
      {formError ? (
        <div
          role="alert"
          className="rounded-[14px] border bg-[#fbe9e7] p-4 text-sm text-foreground"
          style={{ borderColor: "rgba(179,38,30,0.25)" }}
        >
          {formError}
        </div>
      ) : null}

      <Field id="posting-title" label="Title" error={errors.title}>
        <Input
          id="posting-title"
          ref={(el) => {
            refs.current.title = el;
          }}
          value={values.title}
          maxLength={LIMITS.titleMax + 40}
          disabled={busy}
          placeholder="Junior data analyst"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "posting-title-error" : undefined}
          onChange={(e) => set("title", e.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL} aria-hidden>
          Kind
        </span>
        <SegmentedControl
          name="posting-kind"
          legend="Kind"
          value={values.kind}
          onChange={(v) => set("kind", v)}
          disabled={busy}
          options={[
            { value: "Job", label: "Job" },
            { value: "Internship", label: "Internship" },
          ]}
        />
      </div>

      <Field id="posting-company" label="Company name" error={errors.companyName}>
        <Input
          id="posting-company"
          ref={(el) => {
            refs.current.companyName = el;
          }}
          value={values.companyName}
          maxLength={LIMITS.companyMax + 40}
          disabled={busy}
          aria-invalid={errors.companyName ? true : undefined}
          aria-describedby={errors.companyName ? "posting-company-error" : undefined}
          onChange={(e) => set("companyName", e.target.value)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className={LABEL} aria-hidden>
            Work mode
          </span>
          <SegmentedControl
            name="posting-work-mode"
            legend="Work mode"
            value={values.workMode}
            onChange={(v) => set("workMode", v)}
            disabled={busy}
            options={[
              { value: "OnSite", label: "On site" },
              { value: "Remote", label: "Remote" },
              { value: "Hybrid", label: "Hybrid" },
            ]}
          />
        </div>
        <Field
          id="posting-location"
          label="Location"
          hint="Optional. A city or area."
          error={errors.location}
        >
          <Input
            id="posting-location"
            ref={(el) => {
              refs.current.location = el;
            }}
            value={values.location}
            maxLength={LIMITS.locationMax + 40}
            disabled={busy}
            placeholder="Dhaka"
            aria-invalid={errors.location ? true : undefined}
            aria-describedby={
              errors.location ? "posting-location-error" : "posting-location-hint"
            }
            onChange={(e) => set("location", e.target.value)}
          />
        </Field>
      </div>

      <Field
        id="posting-description"
        label="Description"
        hint={
          <span className="flex justify-between gap-3">
            <span>What the work is and what you look for.</span>
            <span aria-live="off">
              {descriptionLength} / {LIMITS.descriptionMax}
            </span>
          </span>
        }
        error={errors.description}
      >
        <Textarea
          id="posting-description"
          ref={(el) => {
            refs.current.description = el;
          }}
          rows={7}
          value={values.description}
          disabled={busy}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={
            errors.description
              ? "posting-description-hint posting-description-error"
              : "posting-description-hint"
          }
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <Field
        id="posting-skills"
        label="Required skills"
        hint='Name skills in plain words, like "Power BI" or "Customer support". Up to 12.'
      >
        <TagInput
          id="posting-skills"
          ref={(el) => {
            refs.current.requiredSkills = el;
          }}
          skills={values.requiredSkills}
          onSkillsChange={(next) => set("requiredSkills", next)}
          draft={skillDraft}
          onDraftChange={setSkillDraft}
          error={errors.requiredSkills}
          disabled={busy}
          describedBy="posting-skills-hint"
        />
      </Field>

      <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end" style={{ borderColor: "var(--border)" }}>
        <Button asChild variant="outline" size="lg" className="h-10 sm:h-9">
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" size="lg" disabled={busy} className="h-10 px-4 sm:h-9">
          {busy ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : null}
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
