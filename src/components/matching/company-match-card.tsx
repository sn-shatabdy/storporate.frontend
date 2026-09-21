import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { CompanyMatch } from "@/lib/api/matching";
import { initialsOf } from "@/components/clubs/club-helpers";
import { formatPublicBudget } from "@/components/sponsorship/sponsorship-helpers";
import { BudgetLine, ChipList } from "@/components/sponsorship/sponsorship-pieces";
import { Button } from "@/components/ui/button";

import { FitBadge } from "./fit-badge";
import { ReasonList } from "./reason-list";

/** A suggested company goal set, as a club sees it. */
export function CompanyMatchCard({ match }: { match: CompanyMatch }) {
  const { company } = match;
  const budget = formatPublicBudget(company.budget);
  return (
    <article
      aria-label={`${company.companyName}, ${company.name}`}
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-base font-semibold text-primary"
          >
            {initialsOf(company.companyName)}
          </span>
          <div className="min-w-0">
            <h2 className="break-words font-heading text-lg font-semibold leading-snug text-foreground">
              {company.companyName}
            </h2>
            <p className="break-words text-sm text-muted-foreground">{company.name}</p>
          </div>
        </div>
        <FitBadge fit={match.fit} />
      </div>

      <ReasonList reasons={match.reasons} />

      <div className="flex flex-col gap-2.5">
        <ChipList items={company.objectives} label="Objectives" size="sm" />
        <ChipList items={company.eventKinds} label="Event kinds" tone="neutral" size="sm" />
        {budget ? <BudgetLine>{budget}</BudgetLine> : null}
      </div>

      <div
        className="flex border-t pt-4"
        style={{ borderColor: "var(--border)" }}
      >
        <Button asChild variant="outline" size="lg" className="h-10 w-full sm:h-9 sm:w-auto">
          <Link
            href={`/club/sponsors/${encodeURIComponent(company.id)}`}
            aria-label={`View goals from ${company.companyName}`}
          >
            View goals
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  );
}
