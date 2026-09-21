import Link from "next/link";

import type { CompanyGoalSummary } from "@/lib/api/sponsorship";
import { initialsOf } from "@/components/clubs/club-helpers";

import { formatPublicBudget } from "./sponsorship-helpers";
import { BudgetLine, ChipList } from "./sponsorship-pieces";

const FIELDS_SHOWN = 3;

/** A goal set as a club sees it in the browse list. The whole card is a link. */
export function CompanyGoalCard({ goal }: { goal: CompanyGoalSummary }) {
  const budget = formatPublicBudget(goal.budget);
  return (
    <Link
      href={`/club/sponsors/${encodeURIComponent(goal.id)}`}
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <article
        className="flex gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-base font-semibold text-primary"
        >
          {initialsOf(goal.companyName)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <h2 className="break-words font-heading text-lg font-semibold leading-snug text-foreground">
              {goal.companyName}
            </h2>
            <p className="mt-0.5 break-words text-sm text-muted-foreground">{goal.name}</p>
          </div>
          <ChipList items={goal.objectives} label="Objectives" size="sm" />
          <ChipList items={goal.eventKinds} label="Event kinds" tone="neutral" size="sm" />
          {goal.fieldsOfStudy.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Wants to reach
              </p>
              <ChipList
                items={goal.fieldsOfStudy}
                label="Fields of study"
                tone="neutral"
                size="sm"
                max={FIELDS_SHOWN}
              />
            </div>
          ) : null}
          {budget ? <BudgetLine>{budget}</BudgetLine> : null}
        </div>
      </article>
    </Link>
  );
}
