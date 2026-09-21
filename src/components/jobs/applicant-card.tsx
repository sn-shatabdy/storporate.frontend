"use client";

import { ChevronDown, Loader2, Check } from "lucide-react";

import { cn } from "cn";

import type {
  ApplicantDecision,
  ApplicantItem,
  ApplicantResponse,
} from "@/lib/api/jobApplications";
import { Button } from "@/components/ui/button";
import { composeDetailLine, initialsFor } from "@/components/talent/helpers";
import { SkillBandPill } from "@/components/talent/skill-band-pill";

import {
  ApplicationStatusPill,
  BandPill,
  FitPill,
  formatPostedDate,
  truncatedList,
} from "./job-pills";

const COLLAPSED_ITEM_LIMIT = 2;

export interface ApplicantCardProps {
  applicant: ApplicantResponse;
  open: boolean;
  /** True while the detail request (which marks Viewed) is in flight. */
  loading: boolean;
  /** Which decision is being saved, if any. */
  savingDecision: ApplicantDecision | null;
  error: string | null;
  onToggle: () => void;
  onDecide: (status: ApplicantDecision) => void;
}

/** One applicant on the employer's applicants list. */
export function ApplicantCard({
  applicant,
  open,
  loading,
  savingDecision,
  error,
  onToggle,
  onDecide,
}: ApplicantCardProps) {
  const detail = composeDetailLine({
    university: applicant.university,
    fieldOfStudy: applicant.fieldOfStudy,
    studyYear: applicant.studyYear,
  });
  const headline = applicant.headline?.trim() ?? "";
  const applied = formatPostedDate(applicant.createdAt);
  const matched = applicant.fit.matched.map((m) => m.name);
  const missing = applicant.fit.missing;
  const panelId = `applicant-panel-${applicant.id}`;
  const items = open
    ? applicant.items
    : applicant.items.slice(0, COLLAPSED_ITEM_LIMIT);
  const hiddenItems = applicant.items.length - items.length;

  return (
    <article
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
      style={{ borderColor: "var(--border)" }}
      aria-label={`Application from ${applicant.displayName}`}
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-base font-semibold text-primary"
        >
          {initialsFor(applicant.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <h2 className="min-w-0 break-words font-heading text-lg font-semibold leading-snug text-foreground">
              {applicant.displayName}
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              <ApplicationStatusPill status={applicant.status} />
              <FitPill label={applicant.fit.label} />
            </div>
          </div>
          {headline ? (
            <p className="mt-0.5 break-words text-sm text-foreground">
              {headline}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[...detail.parts, applied ? `Applied ${applied}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {matched.length > 0 || missing.length > 0 ? (
        <div className="flex flex-col gap-1 text-[13px] leading-5">
          {matched.length > 0 ? (
            <p className="text-foreground">
              <span className="font-semibold">Matches:</span>{" "}
              {truncatedList(matched, 4)}
            </p>
          ) : null}
          {missing.length > 0 ? (
            <p className="text-muted-foreground">
              <span className="font-semibold">Not yet shown:</span>{" "}
              {truncatedList(missing, 4)}
            </p>
          ) : null}
        </div>
      ) : null}

      {applicant.items.length > 0 ? (
        <ul className="flex flex-col gap-2.5" aria-label="Portfolio items">
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`}>
              <ItemRow item={item} />
            </li>
          ))}
          {hiddenItems > 0 ? (
            <li className="text-xs font-medium text-muted-foreground">
              +{hiddenItems} more {hiddenItems === 1 ? "item" : "items"}
            </li>
          ) : null}
        </ul>
      ) : null}

      <div
        className="flex flex-wrap items-center gap-2 border-t pt-4"
        style={{ borderColor: "var(--border)" }}
      >
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-9"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
        >
          {open ? "Hide" : "Open"}
          <ChevronDown
            className={cn(
              "size-4 transition-transform motion-reduce:transition-none",
              open ? "rotate-180" : "",
            )}
            aria-hidden
          />
        </Button>
      </div>

      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label={`Details for ${applicant.displayName}`}
          aria-busy={loading}
          className="flex flex-col gap-5 rounded-xl border bg-secondary p-4 sm:p-5"
          style={{ borderColor: "var(--border)" }}
        >
          {loading ? (
            <p
              role="status"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2
                className="size-4 animate-spin motion-reduce:animate-none"
                aria-hidden
              />
              Loading details…
            </p>
          ) : null}

          <section aria-labelledby={`${panelId}-fit`} className="flex flex-col gap-3">
            <h3
              id={`${panelId}-fit`}
              className="font-heading text-base font-semibold text-foreground"
            >
              How they fit
            </h3>
            <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
              {applicant.fit.matched.map((m) => (
                <li
                  key={`m-${m.name}`}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className="text-sm font-medium text-foreground">{m.name}</span>
                  <BandPill band={m.band} />
                </li>
              ))}
              {missing.map((name) => (
                <li
                  key={`x-${name}`}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className="text-sm font-medium text-foreground">{name}</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    Not shown yet
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby={`${panelId}-decision`} className="flex flex-col gap-3">
            <h3
              id={`${panelId}-decision`}
              className="font-heading text-base font-semibold text-foreground"
            >
              Your decision
            </h3>
            <div className="flex flex-wrap gap-2">
              <DecisionButton
                label="Shortlist"
                pressed={applicant.status === "Shortlisted"}
                saving={savingDecision === "Shortlisted"}
                disabled={savingDecision !== null || loading}
                tone="success"
                onClick={() => onDecide("Shortlisted")}
              />
              <DecisionButton
                label="Not selected"
                pressed={applicant.status === "NotSelected"}
                saving={savingDecision === "NotSelected"}
                disabled={savingDecision !== null || loading}
                tone="warning"
                onClick={() => onDecide("NotSelected")}
              />
            </div>
          </section>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </article>
  );
}

function ItemRow({ item }: { item: ApplicantItem }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm text-foreground">
        <span className="font-medium">{item.label}</span>
        <span className="text-muted-foreground">{` · ${item.category}`}</span>
      </p>
      {item.skills.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`Skills in ${item.label}`}>
          {item.skills.map((skill) => (
            <li key={skill.name}>
              <SkillBandPill name={skill.name} band={skill.band} size="inline" />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const DECISION_TONE_CLASS: Record<
  "success" | "warning",
  { bg: string; text: string; border: string }
> = {
  success: {
    bg: "bg-success-soft",
    text: "text-success",
    border: "border-success",
  },
  warning: {
    bg: "bg-warning-soft",
    text: "text-warning",
    border: "border-warning",
  },
};

function DecisionButton({
  label,
  pressed,
  saving,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  pressed: boolean;
  saving: boolean;
  disabled: boolean;
  tone: "success" | "warning";
  onClick: () => void;
}) {
  const t = DECISION_TONE_CLASS[tone];
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      aria-pressed={pressed}
      disabled={pressed || disabled}
      onClick={onClick}
      className={cn(
        "h-9 disabled:opacity-100",
        pressed && cn(t.bg, t.text, t.border),
      )}
    >
      {saving ? (
        <Loader2
          className="size-4 animate-spin motion-reduce:animate-none"
          aria-hidden
        />
      ) : pressed ? (
        <Check className="size-4" aria-hidden />
      ) : null}
      {saving ? "Saving…" : label}
    </Button>
  );
}