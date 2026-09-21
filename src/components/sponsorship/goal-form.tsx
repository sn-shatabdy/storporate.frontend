"use client";

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2 } from "lucide-react";

import { cn } from "cn";

import {
  EVENT_KINDS,
  OBJECTIVES,
  STUDY_YEARS,
  type SponsorshipGoalSetRequest,
} from "@/lib/api/sponsorship";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/jobs/tag-input";

import {
  addCities,
  addFieldsOfStudy,
  addUniversities,
  EMPTY_DRAFTS,
  EMPTY_GOAL_VALUES,
  ERROR_ORDER,
  FIELD_IDS,
  FOCUS_TARGET,
  formatBudget,
  LIMITS,
  mergeDrafts,
  messageForSponsorshipError,
  requestFromValues,
  snapshotOf,
  validateGoal,
  yearLabel,
  type GoalDrafts,
  type GoalErrors,
  type GoalFormValues,
} from "./sponsorship-helpers";

const LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const FIELD_ERROR = "text-xs font-medium text-[#B3261E]";
const CARD = "flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6";

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={CARD} style={{ borderColor: "var(--border)" }}>
      <div>
        <h2 id={id} className="font-heading text-lg font-semibold text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
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

function describedBy(id: string, hasHint: boolean, error?: string) {
  const parts = [hasHint ? `${id}-hint` : null, error ? `${id}-error` : null];
  return parts.filter(Boolean).join(" ") || undefined;
}

/** A pill button that toggles on and off, for choosing several options. */
function ToggleChip({
  id,
  pressed,
  disabled,
  onToggle,
  children,
}: {
  id?: string;
  pressed: boolean;
  disabled?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60",
        pressed
          ? "border-primary bg-primary font-semibold text-primary-foreground"
          : "border-input bg-background font-medium text-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

/** A labelled group of toggle chips with a shared error line. */
function ChipGroup<T extends string | number>({
  labelId,
  label,
  options,
  selected,
  errorKey,
  idPrefix,
  error,
  hint,
  disabled,
  maxSelected,
  render,
  onChange,
}: {
  labelId: string;
  label: string;
  options: readonly T[];
  selected: T[];
  errorKey: string;
  idPrefix: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  maxSelected?: number;
  render: (option: T) => string;
  onChange: (next: T[]) => void;
}) {
  const atMax = maxSelected !== undefined && selected.length >= maxSelected;
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className={LABEL}>
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={describedBy(errorKey, Boolean(hint), error)}
        className="flex flex-wrap gap-2"
      >
        {options.map((option, index) => {
          const pressed = selected.includes(option);
          return (
            <ToggleChip
              key={String(option)}
              id={`${idPrefix}${index}`}
              pressed={pressed}
              disabled={disabled || (!pressed && atMax)}
              onToggle={() => onChange(toggle(selected, option))}
            >
              {render(option)}
            </ToggleChip>
          );
        })}
      </div>
      {hint ? (
        <p id={`${errorKey}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${errorKey}-error`} className={FIELD_ERROR}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Shared create and edit form for sponsorship goal sets. Validation runs on
 * submit, the first invalid field gets focus, and a server failure shows in
 * an alert above the form. The page decides what happens after a save.
 */
export function GoalForm({
  initialValues = EMPTY_GOAL_VALUES,
  submitLabel,
  cancelHref,
  onSubmit,
}: {
  initialValues?: GoalFormValues;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (request: SponsorshipGoalSetRequest) => Promise<void>;
}) {
  const [values, setValues] = useState<GoalFormValues>(initialValues);
  const [drafts, setDrafts] = useState<GoalDrafts>(EMPTY_DRAFTS);
  const [errors, setErrors] = useState<GoalErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotOf(initialValues));
  const busyRef = useRef(false);

  const dirty = useMemo(
    () =>
      snapshotOf(values) !== savedSnapshot ||
      Boolean(drafts.fields.trim() || drafts.cities.trim() || drafts.universities.trim()),
    [values, drafts, savedSnapshot],
  );

  function set<K extends keyof GoalFormValues>(key: K, value: GoalFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setJustSaved(false);
  }

  function setDraft(key: keyof GoalDrafts, value: string) {
    setDrafts((prev) => ({ ...prev, [key]: value }));
    setJustSaved(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    setFormError(null);

    const finalValues = mergeDrafts(values, drafts);
    const found = validateGoal(finalValues);
    setErrors(found);
    setValues(finalValues);
    if (Object.keys(found).length > 0) {
      const first = ERROR_ORDER.find((id) => found[id]);
      if (first) document.getElementById(FOCUS_TARGET[first] ?? first)?.focus();
      return;
    }

    busyRef.current = true;
    setBusy(true);
    try {
      await onSubmit(requestFromValues(finalValues));
      setDrafts(EMPTY_DRAFTS);
      setSavedSnapshot(snapshotOf(finalValues));
      setJustSaved(true);
    } catch (error) {
      setFormError(messageForSponsorshipError(error, "save"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const notesLength = values.notes.trim().length;
  const budgetPreview = formatBudget(
    /^\d+$/.test(values.budgetMin.trim()) ? Number(values.budgetMin) : null,
    /^\d+$/.test(values.budgetMax.trim()) ? Number(values.budgetMax) : null,
  );
  const statusLine = busy
    ? "Saving…"
    : justSaved
      ? "Saved."
      : dirty
        ? "You have unsaved changes."
        : "";
  const audienceError = errors[FIELD_IDS.audience];

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-[14px] border bg-[#fbe9e7] p-4 text-sm text-foreground"
          style={{ borderColor: "rgba(179,38,30,0.25)" }}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#b3261e]" aria-hidden />
          <span>{formError}</span>
        </div>
      ) : null}

      <Section
        id="goal-basics-heading"
        title="Basics"
        description="Name this goal set so you can tell your sets apart."
      >
        <Field
          id={FIELD_IDS.name}
          label="Goal set name"
          hint="For example, Campus hiring 2027."
          error={errors[FIELD_IDS.name]}
        >
          <Input
            id={FIELD_IDS.name}
            value={values.name}
            maxLength={LIMITS.nameMax + 40}
            disabled={busy}
            autoComplete="off"
            aria-invalid={errors[FIELD_IDS.name] ? true : undefined}
            aria-describedby={describedBy(FIELD_IDS.name, true, errors[FIELD_IDS.name])}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field
          id={FIELD_IDS.companyName}
          label="Company name"
          hint="Clubs see this name."
          error={errors[FIELD_IDS.companyName]}
        >
          <Input
            id={FIELD_IDS.companyName}
            value={values.companyName}
            maxLength={LIMITS.companyMax + 40}
            disabled={busy}
            autoComplete="organization"
            aria-invalid={errors[FIELD_IDS.companyName] ? true : undefined}
            aria-describedby={describedBy(
              FIELD_IDS.companyName,
              true,
              errors[FIELD_IDS.companyName],
            )}
            onChange={(e) => set("companyName", e.target.value)}
          />
        </Field>
      </Section>

      <Section
        id="goal-objectives-heading"
        title="What you want"
        description="Pick what you want to get out of sponsoring."
      >
        <ChipGroup
          labelId="goal-objectives-label"
          label="Objectives"
          options={OBJECTIVES}
          selected={values.objectives}
          errorKey="goal-objectives"
          idPrefix="goal-objective-"
          error={errors[FIELD_IDS.objectives]}
          hint={`Pick up to ${LIMITS.objectivesMax}. ${values.objectives.length} selected.`}
          disabled={busy}
          maxSelected={LIMITS.objectivesMax}
          render={(o) => o}
          onChange={(next) => set("objectives", next)}
        />
      </Section>

      <Section
        id="goal-audience-heading"
        title="Who you want to reach"
        description="Add at least one of these so clubs know which students you mean."
      >
        {audienceError ? (
          <p id={`${FIELD_IDS.audience}-error`} role="alert" className={FIELD_ERROR}>
            {audienceError}
          </p>
        ) : null}

        <Field
          id={FIELD_IDS.fieldsOfStudy}
          label="Fields of study"
          hint={`Like "Computer Science" or "Marketing". Up to ${LIMITS.fieldsMax}.`}
        >
          <TagInput
            id={FIELD_IDS.fieldsOfStudy}
            skills={values.fieldsOfStudy}
            onSkillsChange={(next) => set("fieldsOfStudy", next)}
            draft={drafts.fields}
            onDraftChange={(next) => setDraft("fields", next)}
            error={errors[FIELD_IDS.fieldsOfStudy]}
            disabled={busy}
            describedBy={`${FIELD_IDS.fieldsOfStudy}-hint`}
            maxItems={LIMITS.fieldsMax}
            addItems={addFieldsOfStudy}
            placeholder="Type a field and press Enter"
          />
        </Field>

        <ChipGroup
          labelId="goal-years-label"
          label="Year of study"
          options={STUDY_YEARS}
          selected={values.years}
          errorKey="goal-years"
          idPrefix="goal-year-"
          hint="Pick every year you want to reach."
          disabled={busy}
          render={yearLabel}
          onChange={(next) => set("years", next)}
        />

        <Field
          id={FIELD_IDS.cities}
          label="Cities"
          hint={`Up to ${LIMITS.citiesMax}.`}
        >
          <TagInput
            id={FIELD_IDS.cities}
            skills={values.cities}
            onSkillsChange={(next) => set("cities", next)}
            draft={drafts.cities}
            onDraftChange={(next) => setDraft("cities", next)}
            error={errors[FIELD_IDS.cities]}
            disabled={busy}
            describedBy={`${FIELD_IDS.cities}-hint`}
            maxItems={LIMITS.citiesMax}
            addItems={addCities}
            placeholder="Type a city and press Enter"
          />
        </Field>

        <Field
          id={FIELD_IDS.universities}
          label="Universities"
          hint={`Up to ${LIMITS.universitiesMax}.`}
        >
          <TagInput
            id={FIELD_IDS.universities}
            skills={values.universities}
            onSkillsChange={(next) => set("universities", next)}
            draft={drafts.universities}
            onDraftChange={(next) => setDraft("universities", next)}
            error={errors[FIELD_IDS.universities]}
            disabled={busy}
            describedBy={`${FIELD_IDS.universities}-hint`}
            maxItems={LIMITS.universitiesMax}
            addItems={addUniversities}
            placeholder="Type a university and press Enter"
          />
        </Field>
      </Section>

      <Section
        id="goal-events-heading"
        title="Events you would back"
        description="Pick the kinds of student events you would consider."
      >
        <ChipGroup
          labelId="goal-event-kinds-label"
          label="Event kinds"
          options={EVENT_KINDS}
          selected={values.eventKinds}
          errorKey="goal-event-kinds"
          idPrefix="goal-event-kind-"
          error={errors[FIELD_IDS.eventKinds]}
          disabled={busy}
          render={(k) => k}
          onChange={(next) => set("eventKinds", next)}
        />
      </Section>

      <Section
        id="goal-budget-heading"
        title="Budget"
        description="An optional range in Bangladeshi taka for one sponsorship."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id={FIELD_IDS.budgetMin}
            label="Minimum (BDT)"
            error={errors[FIELD_IDS.budgetMin]}
          >
            <Input
              id={FIELD_IDS.budgetMin}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={values.budgetMin}
              disabled={busy}
              placeholder="50000"
              aria-invalid={errors[FIELD_IDS.budgetMin] ? true : undefined}
              aria-describedby={describedBy(FIELD_IDS.budgetMin, false, errors[FIELD_IDS.budgetMin])}
              onChange={(e) => set("budgetMin", e.target.value)}
            />
          </Field>
          <Field
            id={FIELD_IDS.budgetMax}
            label="Maximum (BDT)"
            error={errors[FIELD_IDS.budgetMax]}
          >
            <Input
              id={FIELD_IDS.budgetMax}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={values.budgetMax}
              disabled={busy}
              placeholder="200000"
              aria-invalid={errors[FIELD_IDS.budgetMax] ? true : undefined}
              aria-describedby={describedBy(FIELD_IDS.budgetMax, false, errors[FIELD_IDS.budgetMax])}
              onChange={(e) => set("budgetMax", e.target.value)}
            />
          </Field>
        </div>
        {budgetPreview ? (
          <p className="text-sm font-medium text-foreground">{budgetPreview}</p>
        ) : null}

        <div
          className="flex items-start justify-between gap-4 rounded-xl border bg-background p-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="min-w-0">
            <p id="goal-visible-label" className="text-sm font-semibold text-foreground">
              Show budget range to clubs
            </p>
            <p id="goal-visible-hint" className="mt-1 text-xs text-muted-foreground">
              When this is off, clubs see your goals but not the amounts.
            </p>
          </div>
          <Switch
            checked={values.visibleToClubs}
            disabled={busy}
            onCheckedChange={(next) => set("visibleToClubs", next)}
            aria-labelledby="goal-visible-label"
            aria-describedby="goal-visible-hint"
          />
        </div>
      </Section>

      <Section
        id="goal-notes-heading"
        title="Notes"
        description="Anything else a club should know before asking."
      >
        <Field
          id={FIELD_IDS.notes}
          label="Notes for clubs"
          hint={
            <span className="flex justify-between gap-3">
              <span>Optional.</span>
              <span>
                {notesLength} / {LIMITS.notesMax}
              </span>
            </span>
          }
          error={errors[FIELD_IDS.notes]}
        >
          <Textarea
            id={FIELD_IDS.notes}
            rows={5}
            value={values.notes}
            disabled={busy}
            aria-invalid={errors[FIELD_IDS.notes] ? true : undefined}
            aria-describedby={describedBy(FIELD_IDS.notes, true, errors[FIELD_IDS.notes])}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </Section>

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
            <Link href={cancelHref}>{justSaved ? "Back to list" : "Cancel"}</Link>
          </Button>
          <Button type="submit" size="lg" disabled={busy} className="h-10 px-5 sm:h-9">
            {busy ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : null}
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
