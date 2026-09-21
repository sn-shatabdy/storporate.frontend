import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { ClubMatch } from "@/lib/api/matching";
import { initialsOf, pluralize } from "@/components/clubs/club-helpers";
import { ChipList } from "@/components/sponsorship/sponsorship-pieces";
import { Button } from "@/components/ui/button";

import { FitBadge } from "./fit-badge";
import { ReasonList } from "./reason-list";

const FIELDS_SHOWN = 3;

/** A suggested club, as a company sees it. */
export function ClubMatchCard({ match }: { match: ClubMatch }) {
  const { club } = match;
  return (
    <article
      aria-label={club.name}
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-base font-semibold text-primary"
          >
            {initialsOf(club.name)}
          </span>
          <div className="min-w-0">
            <h2 className="break-words font-heading text-lg font-semibold leading-snug text-foreground">
              {club.name}
            </h2>
            <p className="break-words text-sm text-muted-foreground">{club.university}</p>
          </div>
        </div>
        <FitBadge fit={match.fit} />
      </div>

      <ReasonList reasons={match.reasons} />

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {pluralize(club.memberCount, "member", "members")}
        </p>
        <ChipList
          items={club.fieldsOfStudy}
          label="Fields of study"
          tone="neutral"
          size="sm"
          max={FIELDS_SHOWN}
        />
      </div>

      <div
        className="flex border-t pt-4"
        style={{ borderColor: "var(--border)" }}
      >
        <Button asChild variant="outline" size="lg" className="h-10 w-full sm:h-9 sm:w-auto">
          <Link
            href={`/employer/clubs/${encodeURIComponent(club.id)}`}
            aria-label={`View club ${club.name}`}
          >
            View club
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  );
}
