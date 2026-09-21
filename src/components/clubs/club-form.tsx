"use client";

import { type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "cn";

import {
  EVENT_FREQUENCIES,
  FREQUENCY_LABELS,
  STUDY_YEARS,
  SUPPORT_NEEDS,
  type EventFrequency,
} from "@/lib/api/clubs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TagInput } from "@/components/jobs/tag-input";

import {
  addFieldsOfStudy,
  emptyEvent,
  eventFieldId,
  FIELD_IDS,
  LIMITS,
  type ClubErrors,
  type ClubFormValues,
  type EventFormValues,
} from "./club-helpers";

const LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const FIELD_ERROR = "text-xs font-medium text-[#B3261E]";
const CARD = "flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6";

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

export function ClubForm({
  values,
  errors,
  disabled,
  fieldDraft,
  onFieldDraftChange,
  onChange,
}: {
  values: ClubFormValues;
  errors: ClubErrors;
  disabled?: boolean;
  fieldDraft: string;
  onFieldDraftChange: (next: string) => void;
  onChange: (next: ClubFormValues) => void;
}) {
  function set<K extends keyof ClubFormValues>(key: K, value: ClubFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function setEvent(key: string, patch: Partial<EventFormValues>) {
    onChange({
      ...values,
      events: values.events.map((e) => (e.key === key ? { ...e, ...patch } : e)),
    });
  }

  const aboutLength = values.about.trim().length;
  const atEventsMax = values.events.length >= LIMITS.eventsMax;

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="club-about-heading" className={CARD} style={{ borderColor: "var(--border)" }}>
        <div>
          <h2 id="club-about-heading" className="font-heading text-lg font-semibold text-foreground">
            About your club
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Who you are, in plain words a company can read quickly.
          </p>
        </div>

        <Field id={FIELD_IDS.name} label="Club name" error={errors[FIELD_IDS.name]}>
          <Input
            id={FIELD_IDS.name}
            value={values.name}
            maxLength={LIMITS.nameMax + 40}
            disabled={disabled}
            autoComplete="off"
            aria-invalid={errors[FIELD_IDS.name] ? true : undefined}
            aria-describedby={describedBy(FIELD_IDS.name, false, errors[FIELD_IDS.name])}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>

        <Field
          id={FIELD_IDS.tagline}
          label="Tagline"
          hint="Optional. One short line."
          error={errors[FIELD_IDS.tagline]}
        >
          <Input
            id={FIELD_IDS.tagline}
            value={values.tagline}
            maxLength={LIMITS.taglineMax + 40}
            disabled={disabled}
            aria-invalid={errors[FIELD_IDS.tagline] ? true : undefined}
            aria-describedby={describedBy(FIELD_IDS.tagline, true, errors[FIELD_IDS.tagline])}
            onChange={(e) => set("tagline", e.target.value)}
          />
        </Field>

        <Field
          id={FIELD_IDS.about}
          label="About"
          hint={
            <span className="flex justify-between gap-3">
              <span>What the club does and who it is for.</span>
              <span>
                {aboutLength} / {LIMITS.aboutMax}
              </span>
            </span>
          }
          error={errors[FIELD_IDS.about]}
        >
          <Textarea
            id={FIELD_IDS.about}
            rows={6}
            value={values.about}
            disabled={disabled}
            aria-invalid={errors[FIELD_IDS.about] ? true : undefined}
            aria-describedby={describedBy(FIELD_IDS.about, true, errors[FIELD_IDS.about])}
            onChange={(e) => set("about", e.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={FIELD_IDS.university} label="University" error={errors[FIELD_IDS.university]}>
            <Input
              id={FIELD_IDS.university}
              value={values.university}
              maxLength={LIMITS.universityMax + 40}
              disabled={disabled}
              aria-invalid={errors[FIELD_IDS.university] ? true : undefined}
              aria-describedby={describedBy(FIELD_IDS.university, false, errors[FIELD_IDS.university])}
              onChange={(e) => set("university", e.target.value)}
            />
          </Field>
          <Field id={FIELD_IDS.city} label="City" hint="Optional." error={errors[FIELD_IDS.city]}>
            <Input
              id={FIELD_IDS.city}
              value={values.city}
              maxLength={LIMITS.cityMax + 40}
              disabled={disabled}
              placeholder="Dhaka"
              aria-invalid={errors[FIELD_IDS.city] ? true : undefined}
              aria-describedby={describedBy(FIELD_IDS.city, true, errors[FIELD_IDS.city])}
              onChange={(e) => set("city", e.target.value)}
            />
          </Field>
        </div>

        <div className="sm:max-w-[calc(50%-0.625rem)]">
          <Field
            id={FIELD_IDS.foundedYear}
            label="Founded year"
            hint="Optional."
            error={errors[FIELD_IDS.foundedYear]}
          >
            <Input
              id={FIELD_IDS.foundedYear}
              type="number"
              inputMode="numeric"
              value={values.foundedYear}
              disabled={disabled}
              aria-invalid={errors[FIELD_IDS.foundedYear] ? true : undefined}
              aria-describedby={describedBy(FIELD_IDS.foundedYear, true, errors[FIELD_IDS.foundedYear])}
              onChange={(e) => set("foundedYear", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section aria-labelledby="club-audience-heading" className={CARD} style={{ borderColor: "var(--border)" }}>
        <div>
          <h2 id="club-audience-heading" className="font-heading text-lg font-semibold text-foreground">
            Your audience
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Who your members are, so companies know who they would reach.
          </p>
        </div>

        <div className="sm:max-w-[calc(50%-0.625rem)]">
          <Field id={FIELD_IDS.memberCount} label="Member count" error={errors[FIELD_IDS.memberCount]}>
            <Input
              id={FIELD_IDS.memberCount}
              type="number"
              inputMode="numeric"
              min={0}
              value={values.memberCount}
              disabled={disabled}
              aria-invalid={errors[FIELD_IDS.memberCount] ? true : undefined}
              aria-describedby={describedBy(FIELD_IDS.memberCount, false, errors[FIELD_IDS.memberCount])}
              onChange={(e) => set("memberCount", e.target.value)}
            />
          </Field>
        </div>

        <Field
          id={FIELD_IDS.fieldsOfStudy}
          label="Fields of study"
          hint={`Add the subjects your members study, like "Computer Science" or "Marketing". Up to ${LIMITS.fieldsMax}.`}
        >
          <TagInput
            id={FIELD_IDS.fieldsOfStudy}
            skills={values.fieldsOfStudy}
            onSkillsChange={(next) => set("fieldsOfStudy", next)}
            draft={fieldDraft}
            onDraftChange={onFieldDraftChange}
            error={errors[FIELD_IDS.fieldsOfStudy]}
            disabled={disabled}
            describedBy={`${FIELD_IDS.fieldsOfStudy}-hint`}
            maxItems={LIMITS.fieldsMax}
            addItems={addFieldsOfStudy}
            placeholder="Type a field and press Enter"
          />
        </Field>

        <div className="flex flex-col gap-1.5">
          <span id="club-years-label" className={LABEL}>
            Study years
          </span>
          <div role="group" aria-labelledby="club-years-label" className="flex flex-wrap gap-2">
            {STUDY_YEARS.map((year) => (
              <ToggleChip
                key={year}
                id={`club-year-${year}`}
                pressed={values.years.includes(year)}
                disabled={disabled}
                onToggle={() => set("years", toggle(values.years, year))}
              >
                Year {year}
              </ToggleChip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Pick every year your members are in.</p>
        </div>
      </section>

      <section aria-labelledby="club-events-heading" className={CARD} style={{ borderColor: "var(--border)" }}>
        <div>
          <h2 id="club-events-heading" className="font-heading text-lg font-semibold text-foreground">
            Events
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The events you run, how big they are and what would help.
          </p>
        </div>

        {values.events.length === 0 ? (
          <p
            className="rounded-xl border border-dashed bg-secondary/50 px-4 py-6 text-center text-sm text-muted-foreground"
            style={{ borderColor: "var(--border)" }}
          >
            Add the events you run. Companies use this to see where they could help.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {values.events.map((event, index) => (
              <li key={event.key}>
                <EventEditor
                  event={event}
                  index={index}
                  errors={errors}
                  disabled={disabled}
                  onPatch={(patch) => setEvent(event.key, patch)}
                  onRemove={() =>
                    set(
                      "events",
                      values.events.filter((e) => e.key !== event.key),
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={disabled || atEventsMax}
            onClick={() => set("events", [...values.events, emptyEvent()])}
            className="h-10 sm:h-9"
          >
            <Plus className="size-4" aria-hidden />
            Add event
          </Button>
          {atEventsMax ? (
            <p className="text-xs text-muted-foreground">
              You can list up to {LIMITS.eventsMax} events.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function EventEditor({
  event,
  index,
  errors,
  disabled,
  onPatch,
  onRemove,
}: {
  event: EventFormValues;
  index: number;
  errors: ClubErrors;
  disabled?: boolean;
  onPatch: (patch: Partial<EventFormValues>) => void;
  onRemove: () => void;
}) {
  const titleId = eventFieldId(event.key, "title");
  const descId = eventFieldId(event.key, "description");
  const attId = eventFieldId(event.key, "attendance");
  const freqId = `club-event-${event.key}-frequency`;
  const needsLabelId = `club-event-${event.key}-needs`;

  return (
    <div
      role="group"
      aria-label={`Event ${index + 1}`}
      className="flex flex-col gap-4 rounded-xl border bg-background p-4"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-heading text-base font-semibold text-foreground">
          Event {index + 1}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="lg"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Remove event ${index + 1}`}
          className="h-9 text-[#b3261e] hover:bg-[#fbe9e7] hover:text-[#b3261e]"
        >
          <Trash2 className="size-4" aria-hidden />
          Remove event
        </Button>
      </div>

      <Field id={titleId} label="Event title" error={errors[titleId]}>
        <Input
          id={titleId}
          value={event.title}
          maxLength={LIMITS.eventTitleMax + 40}
          disabled={disabled}
          placeholder="Annual hackathon"
          aria-invalid={errors[titleId] ? true : undefined}
          aria-describedby={describedBy(titleId, false, errors[titleId])}
          onChange={(e) => onPatch({ title: e.target.value })}
        />
      </Field>

      <Field
        id={descId}
        label="Short description"
        hint="Optional."
        error={errors[descId]}
      >
        <Textarea
          id={descId}
          rows={3}
          value={event.description}
          disabled={disabled}
          className="min-h-[72px]"
          aria-invalid={errors[descId] ? true : undefined}
          aria-describedby={describedBy(descId, true, errors[descId])}
          onChange={(e) => onPatch({ description: e.target.value })}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={attId} label="Typical attendance" error={errors[attId]}>
          <Input
            id={attId}
            type="number"
            inputMode="numeric"
            min={1}
            value={event.typicalAttendance}
            disabled={disabled}
            aria-invalid={errors[attId] ? true : undefined}
            aria-describedby={describedBy(attId, false, errors[attId])}
            onChange={(e) => onPatch({ typicalAttendance: e.target.value })}
          />
        </Field>
        <Field id={freqId} label="How often">
          <select
            id={freqId}
            value={event.frequency}
            disabled={disabled}
            onChange={(e) => onPatch({ frequency: e.target.value as EventFrequency })}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {EVENT_FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABELS[f]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-col gap-1.5">
        <span id={needsLabelId} className={LABEL}>
          Support needed
        </span>
        <div role="group" aria-labelledby={needsLabelId} className="flex flex-wrap gap-2">
          {SUPPORT_NEEDS.map((need) => (
            <ToggleChip
              key={need}
              pressed={event.supportNeeds.includes(need)}
              disabled={disabled}
              onToggle={() => onPatch({ supportNeeds: toggle(event.supportNeeds, need) })}
            >
              {need}
            </ToggleChip>
          ))}
        </div>
      </div>
    </div>
  );
}
