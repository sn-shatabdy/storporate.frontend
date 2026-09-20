"use client";

import { forwardRef } from "react";
import type { ChangeEvent } from "react";

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import {
  messageForFieldError,
  type DiscoveryFieldError,
  type ProfileDraft,
} from "./helpers";

/**
 * STOR-43 Phase 3 — the on-state details form. The page passes it the
 * current draft + per-field error map (validated by the shared
 * `validateDraft` helper) and a stable set of change handlers that
 * propagate each edit up into the page's `setDraft`.
 *
 * Layout:
 *   - Display name (full width, no show switch — always shown when the
 *     student opts in).
 *   - Headline (full width, with a small-size "Show" switch on the right
 *     of the label).
 *   - University / Field of study / Study year in a responsive 2-col grid
 *     (each with its own small-size "Show" switch).
 *
 * The inputs use the shared `<Input>` primitive (Phase 3) so the height
 * + padding + focus ring stay uniform with the rest of the app. The
 * study-year `<select>` uses the same plain-select pattern the portfolio
 * page already uses (the existing app has no Select primitive).
 */
export interface ProfileDetailsFormErrors {
  displayName?: DiscoveryFieldError;
  headline?: DiscoveryFieldError;
  university?: DiscoveryFieldError;
  fieldOfStudy?: DiscoveryFieldError;
}

export interface ProfileDetailsFormProps {
  draft: ProfileDraft;
  errors: ProfileDetailsFormErrors;
  onDisplayNameChange: (next: string) => void;
  onHeadlineChange: (next: string) => void;
  onUniversityChange: (next: string) => void;
  onFieldOfStudyChange: (next: string) => void;
  onStudyYearChange: (next: number | null) => void;
  onShowHeadlineChange: (next: boolean) => void;
  onShowUniversityChange: (next: boolean) => void;
  onShowFieldOfStudyChange: (next: boolean) => void;
  onShowStudyYearChange: (next: boolean) => void;
}

/** The page forwards this ref into the display name input so a failed
 *  client validation can move focus there (the design spec rule). */
export const ProfileDetailsForm = forwardRef<
  HTMLInputElement,
  ProfileDetailsFormProps
>(function ProfileDetailsForm(props, displayNameRef) {
  const {
    draft,
    errors,
    onDisplayNameChange,
    onHeadlineChange,
    onUniversityChange,
    onFieldOfStudyChange,
    onStudyYearChange,
    onShowHeadlineChange,
    onShowUniversityChange,
    onShowFieldOfStudyChange,
    onShowStudyYearChange,
  } = props;

  const displayNameError = errors.displayName
    ? messageForFieldError(errors.displayName)
    : null;
  const displayNameDescribedBy = displayNameError
    ? "visibility-display-name-error"
    : undefined;
  const headlineError = errors.headline
    ? messageForFieldError(errors.headline)
    : null;
  const headlineDescribedBy = headlineError
    ? "visibility-headline-error"
    : undefined;
  const universityError = errors.university
    ? messageForFieldError(errors.university)
    : null;
  const universityDescribedBy = universityError
    ? "visibility-university-error"
    : undefined;
  const fieldOfStudyError = errors.fieldOfStudy
    ? messageForFieldError(errors.fieldOfStudy)
    : null;
  const fieldOfStudyDescribedBy = fieldOfStudyError
    ? "visibility-field-of-study-error"
    : undefined;

  return (
    <section
      className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      style={{ borderColor: "var(--border)" }}
    >
      <header>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Your details
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Employers see the details you keep switched on. Nobody verifies
          them yet.
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="visibility-display-name"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Display name
        </label>
        <Input
          id="visibility-display-name"
          ref={displayNameRef}
          value={draft.displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          placeholder="e.g. Nadia Rahman"
          maxLength={200}
          aria-invalid={Boolean(errors.displayName)}
          aria-describedby={displayNameDescribedBy}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Always shown to employers. Up to 80 characters.
        </p>
        {displayNameError && (
          <p
            id="visibility-display-name-error"
            className="mt-1.5 text-xs font-medium text-[#b3261e]"
          >
            {displayNameError}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="visibility-headline"
            className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Headline
          </label>
          <ShowSwitch
            label="Show headline"
            checked={draft.showHeadline}
            onCheckedChange={onShowHeadlineChange}
          />
        </div>
        <Input
          id="visibility-headline"
          value={draft.headline}
          onChange={(event) => onHeadlineChange(event.target.value)}
          placeholder="e.g. Data analysis with dbt + Power BI"
          maxLength={120}
          aria-invalid={Boolean(errors.headline)}
          aria-describedby={headlineDescribedBy}
          autoComplete="off"
        />
        {headlineError && (
          <p
            id="visibility-headline-error"
            className="mt-1.5 text-xs font-medium text-[#b3261e]"
          >
            {headlineError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="visibility-university"
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              University
            </label>
            <ShowSwitch
              label="Show university"
              checked={draft.showUniversity}
              onCheckedChange={onShowUniversityChange}
            />
          </div>
          <Input
            id="visibility-university"
            value={draft.university}
            onChange={(event) => onUniversityChange(event.target.value)}
            placeholder="e.g. BUET"
            maxLength={120}
            aria-invalid={Boolean(errors.university)}
            aria-describedby={universityDescribedBy}
            autoComplete="off"
          />
          {universityError && (
            <p
              id="visibility-university-error"
              className="mt-1.5 text-xs font-medium text-[#b3261e]"
            >
              {universityError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="visibility-field-of-study"
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Field of study
            </label>
            <ShowSwitch
              label="Show field of study"
              checked={draft.showFieldOfStudy}
              onCheckedChange={onShowFieldOfStudyChange}
            />
          </div>
          <Input
            id="visibility-field-of-study"
            value={draft.fieldOfStudy}
            onChange={(event) => onFieldOfStudyChange(event.target.value)}
            placeholder="e.g. Computer Science"
            maxLength={120}
            aria-invalid={Boolean(errors.fieldOfStudy)}
            aria-describedby={fieldOfStudyDescribedBy}
            autoComplete="off"
          />
          {fieldOfStudyError && (
            <p
              id="visibility-field-of-study-error"
              className="mt-1.5 text-xs font-medium text-[#b3261e]"
            >
              {fieldOfStudyError}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="visibility-study-year"
              className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Study year
            </label>
            <ShowSwitch
              label="Show study year"
              checked={draft.showStudyYear}
              onCheckedChange={onShowStudyYearChange}
            />
          </div>
          <select
            id="visibility-study-year"
            value={draft.studyYear === null ? "" : String(draft.studyYear)}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              const raw = event.target.value;
              onStudyYearChange(raw === "" ? null : Number(raw));
            }}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <option value="">Not set</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((year) => (
              <option key={year} value={year}>
                Year {year}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
});

interface ShowSwitchProps {
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}

function ShowSwitch({ label, checked, onCheckedChange }: ShowSwitchProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Show</span>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
      />
    </div>
  );
}
