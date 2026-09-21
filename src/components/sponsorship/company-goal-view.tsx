import type { CompanyGoalDetail } from "@/lib/api/sponsorship";
import { formatPostedDate } from "@/components/jobs/job-pills";
import { initialsOf } from "@/components/clubs/club-helpers";

import { formatPublicBudget, yearLabel } from "./sponsorship-helpers";
import { BudgetLine, ChipList } from "./sponsorship-pieces";

const CARD = "flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6";
const SECTION_TITLE = "font-heading text-lg font-semibold text-foreground";
const SMALL_LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function Group({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone?: "accent" | "neutral";
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className={SMALL_LABEL}>{label}</p>
      {items.length > 0 ? (
        <ChipList items={items} label={label} tone={tone ?? "neutral"} />
      ) : (
        <p className="text-sm text-muted-foreground">Not specified.</p>
      )}
    </div>
  );
}

/** What one company wants from sponsoring, as a club reads it. */
export function CompanyGoalView({ goal }: { goal: CompanyGoalDetail }) {
  const budget = formatPublicBudget(goal.budget);
  const updated = formatPostedDate(goal.updatedAt);
  const years = [...goal.audience.years].sort((a, b) => a - b).map(yearLabel);

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Goal summary"
        className={CARD}
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent font-heading text-lg font-semibold text-primary"
          >
            {initialsOf(goal.companyName)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="break-words font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
              {goal.companyName}
            </h1>
            <p className="mt-1 break-words text-sm text-foreground sm:text-base">
              {goal.name}
            </p>
            {updated ? (
              <p className="mt-2 text-xs text-muted-foreground">Updated {updated}</p>
            ) : null}
          </div>
        </div>
        {budget ? <BudgetLine>{budget}</BudgetLine> : null}
      </section>

      <section
        aria-labelledby="goal-view-objectives"
        className={CARD}
        style={{ borderColor: "var(--border)" }}
      >
        <h2 id="goal-view-objectives" className={SECTION_TITLE}>
          What they want
        </h2>
        <Group label="Objectives" items={goal.objectives} tone="accent" />
      </section>

      <section
        aria-labelledby="goal-view-audience"
        className={CARD}
        style={{ borderColor: "var(--border)" }}
      >
        <h2 id="goal-view-audience" className={SECTION_TITLE}>
          Who they want to reach
        </h2>
        <Group label="Fields of study" items={goal.audience.fieldsOfStudy} />
        <Group label="Study years" items={years} />
        <Group label="Cities" items={goal.audience.cities} />
        <Group label="Universities" items={goal.audience.universities} />
      </section>

      <section
        aria-labelledby="goal-view-events"
        className={CARD}
        style={{ borderColor: "var(--border)" }}
      >
        <h2 id="goal-view-events" className={SECTION_TITLE}>
          Events they would back
        </h2>
        <Group label="Event kinds" items={goal.eventKinds} />
      </section>

      {goal.notes ? (
        <section
          aria-labelledby="goal-view-notes"
          className={CARD}
          style={{ borderColor: "var(--border)" }}
        >
          <h2 id="goal-view-notes" className={SECTION_TITLE}>
            Notes
          </h2>
          <p className="whitespace-pre-line break-words text-sm leading-6 text-foreground">
            {goal.notes}
          </p>
        </section>
      ) : null}
    </div>
  );
}
