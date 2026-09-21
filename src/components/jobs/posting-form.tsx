"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
} from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import type { JobPostingRequest } from "@/lib/api/jobPostings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

import { SegmentedControl } from "./segmented-control";
import { TagInput } from "./tag-input";
import {
  formatBdt,
  KindPill,
  SkillChip,
  WORK_MODE_LABELS,
} from "./job-pills";
import {
  addSkills,
  EMPTY_VALUES,
  FIELD_ORDER,
  LIMITS,
  parsePayInput,
  requestFromValues,
  validatePosting,
  type PostingErrors,
  type PostingField,
  type PostingFormValues,
} from "./posting-helpers";

const FIELD_ERROR = "mt-1 text-xs font-medium text-danger";
const HINT = "mt-1 text-xs font-medium text-muted-foreground";

const TITLE_LABEL =
  "block text-[14px] font-bold leading-tight text-foreground";

/** Map a save failure into one plain sentence for the form-level alert. */
export function messageForPostingError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "job_posting_closed") {
      return "This opening is closed, so it can no longer be changed.";
    }
    if (error.errorCode === "job_posting_conflict") {
      return "This opening changed in another tab. Reload to see the latest.";
    }
    if (error.errorCode === "job_posting_not_found") {
      return "This opening could not be found.";
    }
    if (
      error.errorCode === "job_posting_deadline_invalid" ||
      error.errorCode === "job_posting_openings_invalid" ||
      error.errorCode === "job_posting_compensation_invalid"
    ) {
      return "Some fields are not in the right shape. Check them and try again.";
    }
    if (error.status === 400 && error.message) return error.message;
  }
  return "Could not save the opening. Check your connection and try again.";
}

interface SectionCardProps {
  title: string;
  hint?: string;
  children: React.ReactNode;
}

function SectionCard({ title, hint, children }: SectionCardProps) {
  return (
    <section
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      style={{ borderColor: "var(--border)" }}
    >
      <div>
        <h2 className="font-heading text-[19px] font-semibold leading-tight text-foreground">
          {title}
        </h2>
        {hint ? (
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  /** When true the label is a real fieldset legend (segmented controls). */
  asLegend?: boolean;
  children: React.ReactNode;
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: FieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={`${TITLE_LABEL}${required ? " after:ml-0.5 after:text-danger after:content-['*']" : ""}`}
      >
        {label}
      </label>
      {hint ? <p className={HINT}>{hint}</p> : null}
      {children}
      {error ? <p className={FIELD_ERROR}>{error}</p> : null}
    </div>
  );
}

/**
 * Shared create and edit form for job and internship openings. Five
 * headed section cards in the order Role, Where and when, About the
 * role, Skills, Pay. The action bar is a sticky bottom bar with a
 * polite live status line. Validation runs on submit; the first
 * invalid field receives focus. Server errors map to one sentence in
 * a `role="alert"` summary box.
 */
export function PostingForm({
  initialValues = EMPTY_VALUES,
  submitLabel,
  cancelHref,
  onSubmit,
  onConflict,
  onPayChange,
}: {
  initialValues?: PostingFormValues;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (request: JobPostingRequest) => Promise<void>;
  /** Called when the server responds 409 with `job_posting_conflict`.
   *  The parent typically refetches the posting and resets the form. */
  onConflict?: () => void;
  /** Called whenever the form state changes; the preview card reads
   *  values from the parent state via `values`. */
  onPayChange?: (v: PostingFormValues) => void;
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
    applicationDeadline: null,
    openings: null,
    compensation: null,
  });

  function set<K extends keyof PostingFormValues>(
    key: K,
    value: PostingFormValues[K],
  ) {
    setValues((v) => {
      const next = { ...v, [key]: value };
      onPayChange?.(next);
      return next;
    });
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
      if (
        error instanceof ApiError &&
        error.errorCode === "job_posting_conflict"
      ) {
        setFormError(messageForPostingError(error));
        onConflict?.();
      } else {
        setFormError(messageForPostingError(error));
      }
      setBusy(false);
    }
  }

  const descriptionLength = values.description.trim().length;
  const isEdit = initialValues !== EMPTY_VALUES;
  const statusLabel = busy
    ? "Saving\u2026"
    : formError
      ? "Check the highlighted fields"
      : isEdit
        ? "Editing"
        : "Draft in progress";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={busy}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-5">
          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-[14px] border border-danger bg-danger-soft p-4 text-sm text-foreground"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-danger"
                aria-hidden
              />
              <span className="flex-1">{formError}</span>
              {formError && formError.includes("another tab") ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-9 px-3 text-sm"
                  onClick={onConflict}
                >
                  Reload
                </Button>
              ) : null}
            </div>
          ) : null}

          <SectionCard
            title="Role"
            hint="The basics students see first."
          >
            <Field
              id="posting-title"
              label="Title"
              required
              error={errors.title}
            >
              <Input
                id="posting-title"
                ref={(el) => {
                  refs.current.title = el;
                }}
                value={values.title}
                maxLength={LIMITS.titleMax + 40}
                disabled={busy}
                placeholder="For example, Software Engineering Intern"
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "posting-title-error" : undefined}
                onChange={(e) => set("title", e.target.value)}
                className="h-[46px] rounded-[10px] border border-border px-3.5 text-[15px] focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </Field>

            <SegmentedControl
              name="posting-kind"
              legend="Kind"
              size="lg"
              value={values.kind}
              onChange={(v) => set("kind", v)}
              disabled={busy}
              options={[
                { value: "Job", label: "Job" },
                { value: "Internship", label: "Internship" },
              ]}
            />

            <Field
              id="posting-company"
              label="Company name"
              required
              error={errors.companyName}
            >
              <Input
                id="posting-company"
                ref={(el) => {
                  refs.current.companyName = el;
                }}
                value={values.companyName}
                maxLength={LIMITS.companyMax + 40}
                disabled={busy}
                placeholder="Your company"
                aria-invalid={errors.companyName ? true : undefined}
                aria-describedby={
                  errors.companyName ? "posting-company-error" : undefined
                }
                onChange={(e) => set("companyName", e.target.value)}
                className="h-[46px] rounded-[10px] border border-border px-3.5 text-[15px]"
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="Where and when"
            hint="Where the work happens and how long students have to apply."
          >
            <SegmentedControl
              name="posting-work-mode"
              legend="Work mode"
              size="lg"
              value={values.workMode}
              onChange={(v) => set("workMode", v)}
              disabled={busy}
              options={[
                { value: "OnSite", label: "On-site" },
                { value: "Remote", label: "Remote" },
                { value: "Hybrid", label: "Hybrid" },
              ]}
            />

            <Field
              id="posting-location"
              label="Location"
              hint="Optional for remote roles."
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
                placeholder="City or area"
                aria-invalid={errors.location ? true : undefined}
                aria-describedby={
                  errors.location
                    ? "posting-location-error"
                    : "posting-location-hint"
                }
                onChange={(e) => set("location", e.target.value)}
                className="h-[46px] rounded-[10px] border border-border px-3.5 text-[15px]"
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="posting-deadline"
                label="Application deadline"
                hint="Optional. After this date students no longer see the opening."
                error={errors.applicationDeadline}
              >
                <Input
                  id="posting-deadline"
                  ref={(el) => {
                    refs.current.applicationDeadline = el;
                  }}
                  type="date"
                  value={values.applicationDeadline}
                  disabled={busy}
                  aria-invalid={
                    errors.applicationDeadline ? true : undefined
                  }
                  aria-describedby={
                    errors.applicationDeadline
                      ? "posting-deadline-error"
                      : undefined
                  }
                  onChange={(e) =>
                    set("applicationDeadline", e.target.value)
                  }
                  className="h-[46px] rounded-[10px] border border-border px-3.5 text-[15px]"
                />
              </Field>
              <Field
                id="posting-openings"
                label="Number of openings"
                hint="How many people you plan to take on."
                error={errors.openings}
              >
                <Input
                  id="posting-openings"
                  ref={(el) => {
                    refs.current.openings = el;
                  }}
                  type="number"
                  inputMode="numeric"
                  min={LIMITS.openingsMin}
                  max={LIMITS.openingsMax}
                  step={1}
                  value={String(values.openings)}
                  disabled={busy}
                  aria-invalid={errors.openings ? true : undefined}
                  aria-describedby={
                    errors.openings ? "posting-openings-error" : undefined
                  }
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      set("openings", 0);
                      return;
                    }
                    const n = Number(raw);
                    if (Number.isFinite(n)) set("openings", Math.trunc(n));
                  }}
                  className="h-[46px] rounded-[10px] border border-border px-3.5 text-[15px]"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="About the role"
            hint="Ordinary words work best."
          >
            <Field
              id="posting-description"
              label="Description"
              required
              hint={
                <span className="flex flex-wrap items-center justify-between gap-2 text-[13px] font-medium text-muted-foreground">
                  <span>
                    Describe the work, the team, and what a student will learn.
                  </span>
                  <span aria-live="polite">
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
                    ? "posting-description-error posting-description-hint"
                    : "posting-description-hint"
                }
                onChange={(e) => set("description", e.target.value)}
                className="rounded-[10px] border border-border px-3.5 py-3 text-[15px] leading-[1.55]"
              />
            </Field>
          </SectionCard>

          <SectionCard title="Skills" hint="These decide how each student fits.">
            <Field
              id="posting-skills"
              label="Skills students need"
              required
              hint={
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Type a skill and press Enter. Students see how well they
                    match each one.
                  </span>
                  <span className="text-[13px] font-semibold text-muted-foreground">
                    {values.requiredSkills.length} of {LIMITS.skillsMax}
                  </span>
                </span>
              }
              error={errors.requiredSkills}
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
                // The form-level error renders in the Field below.
                // The TagInput keeps its own transient `notice` (for
                // per-keystroke issues like the 12-cap), which is fine
                // because it lives inside the same `describedBy` group.
                disabled={busy}
                describedBy="posting-skills-hint"
              />
            </Field>
          </SectionCard>

          <SectionCard
            title="Pay"
            hint="Optional. Amounts are in Bangladeshi taka per month."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="posting-pay-min"
                label="Lowest pay"
              >
                <PayInput
                  id="posting-pay-min"
                  value={values.compensation.min}
                  disabled={busy}
                  onChange={(n) =>
                    set("compensation", {
                      ...values.compensation,
                      min: n,
                    })
                  }
                />
              </Field>
              <Field
                id="posting-pay-max"
                label="Highest pay"
              >
                <PayInput
                  id="posting-pay-max"
                  value={values.compensation.max}
                  disabled={busy}
                  onChange={(n) =>
                    set("compensation", {
                      ...values.compensation,
                      max: n,
                    })
                  }
                />
              </Field>
            </div>
            {errors.compensation ? (
              <p className="text-xs font-medium text-danger">
                {errors.compensation}
              </p>
            ) : null}
            <div className="flex items-start justify-between gap-4 pt-1">
              <label
                htmlFor="posting-pay-show"
                className="block text-[14px] font-bold leading-tight text-foreground"
              >
                Show pay to students
                <span className="mt-0.5 block text-[13px] font-medium text-muted-foreground">
                  Off by default. When on, students see this range on the
                  opening.
                </span>
              </label>
              <Switch
                id="posting-pay-show"
                checked={values.compensation.visibleToStudents}
                onCheckedChange={(next) =>
                  set("compensation", {
                    ...values.compensation,
                    visibleToStudents: next,
                  })
                }
                disabled={busy}
                aria-label="Show pay to students"
              />
            </div>
          </SectionCard>
        </div>

        <aside
          aria-label="How students will see it"
          className="hidden lg:sticky lg:top-6 lg:flex lg:flex-col lg:gap-3"
        >
          <p className="font-heading text-[15px] font-semibold uppercase tracking-wide text-muted-foreground">
            How students will see it
          </p>
          <PreviewCard values={values} />
          <p className="text-[13px] leading-[1.5] text-muted-foreground">
            The pay range shows only when you turn on Show pay to students.
            Each student also sees how well they fit, worked out from their
            own portfolio.
          </p>
        </aside>
      </div>

      <div
        className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-2xl border bg-card/95 p-3 shadow-[0_8px_24px_rgba(42,24,48,0.14)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          role="status"
          aria-live="polite"
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-muted-foreground"
        >
          {busy ? (
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none text-success"
              aria-hidden
            />
          ) : formError ? (
            <AlertTriangle className="size-4 text-danger" aria-hidden />
          ) : (
            <CheckCircle2 className="size-4 text-success" aria-hidden />
          )}
          {statusLabel}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-11 px-4"
            disabled={busy}
          >
            <Link href={cancelHref}>Cancel</Link>
          </Button>
          <Button
            type="submit"
            size="lg"
            className="h-11 px-5"
            disabled={busy}
          >
            {busy ? (
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
            ) : null}
            {busy ? "Saving\u2026" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** BDT-prefixed pay input. Whole taka, optional comma separator. */
function PayInput({
  id,
  value,
  disabled,
  onChange,
}: {
  id: string;
  value: number | null;
  disabled?: boolean;
  onChange: (next: number | null) => void;
}) {
  const text = value === null ? "" : value.toLocaleString("en-US");
  return (
    <div className="flex h-[46px] items-center overflow-hidden rounded-[10px] border border-border bg-background focus-within:ring-2 focus-within:ring-ring/40">
      <span className="flex h-full items-center bg-secondary px-3 text-[14px] font-bold text-muted-foreground">
        BDT
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        onChange={(e) => {
          const parsed = parsePayInput(e.target.value);
          if (parsed === null) {
            onChange(null);
            return;
          }
          if (Number.isNaN(parsed)) return;
          onChange(parsed);
        }}
        className="h-full min-w-0 flex-1 bg-transparent px-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

function PreviewCard({ values }: { values: PostingFormValues }) {
  const title = values.title.trim() || "New opening";
  const company = values.companyName.trim();
  const location = values.location.trim();
  const deadline = values.applicationDeadline.trim();
  const showPay =
    values.compensation.visibleToStudents &&
    (values.compensation.min !== null || values.compensation.max !== null);
  const pay = showPay
    ? formatBdtRange(values.compensation.min, values.compensation.max)
    : null;
  return (
    <article
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex flex-wrap gap-2">
        <KindPill kind={values.kind} />
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-[12px] font-bold text-muted-foreground">
          {WORK_MODE_LABELS[values.workMode]}
        </span>
      </div>
      <div className="font-heading text-[19px] font-semibold leading-tight text-foreground">
        {title}
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1.5">
        {company ? (
          <Meta icon={<Building2 className="size-4" aria-hidden />}>{company}</Meta>
        ) : null}
        {location ? (
          <Meta icon={<MapPin className="size-4" aria-hidden />}>{location}</Meta>
        ) : null}
        {deadline ? (
          <Meta icon={<Calendar className="size-4" aria-hidden />}>
            Closes {formatLongDate(deadline)}
          </Meta>
        ) : null}
        {pay ? (
          <Meta icon={<BanknoteIcon />}>{pay}</Meta>
        ) : null}
      </div>
      <p className="text-[13px] font-bold text-muted-foreground">
        Skills needed
      </p>
      <div className="flex flex-wrap gap-1.5">
        {values.requiredSkills.length === 0 ? (
          <span className="text-[13px] text-muted-foreground">
            Add at least one skill.
          </span>
        ) : (
          values.requiredSkills.map((skill) => (
            <SkillChip key={skill}>{skill}</SkillChip>
          ))
        )}
      </div>
    </article>
  );
}

function Meta({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}

function BanknoteIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      <rect width="20" height="12" x="2" y="6" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

function formatBdtRange(
  min: number | null,
  max: number | null,
): string | null {
  if (min != null && max != null) {
    return `${formatBdt(min)} to ${formatBdt(max)}`;
  }
  if (min != null) return `From ${formatBdt(min)}`;
  if (max != null) return `Up to ${formatBdt(max)}`;
  return null;
}

function formatLongDate(yyyyMmDd: string): string {
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** A no-op hook used by the test entry point so the preview card stays in
 *  sync with the parent form state without coupling. Exposed here so the
 *  unit tests can read the latest values through `data-form-state`. */
export function usePostingFormValues(initial: PostingFormValues) {
  return useMemo(() => initial, [initial]);
}
