"use client";

import Link from "next/link";
import { Pause, Pencil, Play, Sparkles, Trash2 } from "lucide-react";

import type { SponsorshipGoalSetResponse } from "@/lib/api/sponsorship";
import { Button } from "@/components/ui/button";
import { formatPostedDate } from "@/components/jobs/job-pills";

import { formatBudget } from "./sponsorship-helpers";
import { BudgetLine, ChipList, GoalStatusPill } from "./sponsorship-pieces";

/** One of the company's own goal sets, with Edit, Pause or Resume, and Delete. */
export function GoalSetCard({
  goal,
  busy,
  anyBusy,
  confirming,
  onToggleStatus,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  goal: SponsorshipGoalSetResponse;
  busy: boolean;
  anyBusy: boolean;
  confirming: boolean;
  onToggleStatus: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  const paused = goal.status === "Paused";
  const range = formatBudget(goal.budget.min, goal.budget.max);
  const updated = formatPostedDate(goal.updatedAt);

  return (
    <article
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
      style={{ borderColor: "var(--border)" }}
      aria-busy={busy}
      aria-label={goal.name}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words font-heading text-lg font-semibold leading-snug text-foreground">
            {goal.name}
          </h2>
          <GoalStatusPill status={goal.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {goal.companyName}
          {updated ? <span className="text-xs"> · Updated {updated}</span> : null}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <ChipList items={goal.objectives} label="Objectives" />
        <ChipList items={goal.eventKinds} label="Event kinds" tone="neutral" />
      </div>

      {range ? (
        <BudgetLine>
          {range}
          {goal.budget.visibleToClubs ? null : (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              Hidden from clubs
            </span>
          )}
        </BudgetLine>
      ) : (
        <BudgetLine muted>Budget not set</BudgetLine>
      )}

      {paused ? (
        <p className="text-xs text-muted-foreground">
          Clubs cannot see this goal set while it is paused.
        </p>
      ) : null}

      {confirming ? (
        <div
          role="alertdialog"
          aria-label={`Delete ${goal.name}`}
          className="flex flex-col gap-3 rounded-xl border bg-[#fbe9e7] p-4"
          style={{ borderColor: "rgba(179,38,30,0.25)" }}
        >
          <p className="text-sm text-foreground">
            Delete this goal set? Clubs will no longer see it. This cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="lg"
              disabled={busy}
              onClick={onDelete}
              className="h-9 bg-[#b3261e] text-white hover:bg-[#b3261e]/90"
            >
              {busy ? "Deleting…" : "Yes, delete it"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={onCancelDelete}
              className="h-9 bg-white"
            >
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="flex flex-wrap gap-2 border-t pt-4"
          style={{ borderColor: "var(--border)" }}
        >
          <Button asChild size="lg" className="h-9">
            <Link href={`/employer/sponsorship/${encodeURIComponent(goal.id)}/matches`}>
              <Sparkles className="size-4" aria-hidden />
              See matching clubs
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-9">
            <Link href={`/employer/sponsorship/${encodeURIComponent(goal.id)}/edit`}>
              <Pencil className="size-4" aria-hidden />
              Edit
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={anyBusy}
            onClick={onToggleStatus}
            className="h-9"
          >
            {paused ? (
              <Play className="size-4" aria-hidden />
            ) : (
              <Pause className="size-4" aria-hidden />
            )}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={anyBusy}
            onClick={onAskDelete}
            className="h-9 text-[#b3261e] hover:bg-[#fbe9e7] hover:text-[#b3261e]"
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </Button>
        </div>
      )}
    </article>
  );
}
