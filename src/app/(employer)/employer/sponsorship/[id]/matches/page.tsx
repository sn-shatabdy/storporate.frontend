"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import { listClubMatches } from "@/lib/api/matching";
import { getGoalSet, type SponsorshipGoalSetResponse } from "@/lib/api/sponsorship";
import { ClubMatchCard } from "@/components/matching/club-match-card";
import { MatchResults } from "@/components/matching/match-results";
import { MatchSearchBox } from "@/components/matching/match-search-box";
import { messageForMatchFailure } from "@/components/matching/matching-helpers";
import { useMatchResults } from "@/components/matching/use-match-results";
import { SponsorshipEmptyState } from "@/components/sponsorship/sponsorship-pieces";

/** `/employer/sponsorship/{id}/matches`: clubs that fit one goal set. The
 *  (employer) layout owns the authorization gate. */
export default function GoalSetMatchesPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;
  const id = params?.id;

  const load = useCallback(
    (token: string, q: string, signal: AbortSignal) =>
      listClubMatches(token, id ?? "", q, signal),
    [id],
  );
  const { text, setText, query, items, loading, failure, retry } = useMatchResults(
    load,
    Boolean(id),
  );

  // The goal set gives the page its heading. The matches call reports a
  // missing goal set too, so a failure here only leaves the heading generic.
  const [goal, setGoal] = useState<SponsorshipGoalSetResponse | null>(null);
  const [goalMissing, setGoalMissing] = useState(false);
  useEffect(() => {
    if (!accessToken || !id) return;
    const controller = new AbortController();
    (async () => {
      try {
        const result = await getGoalSet(accessToken, id, controller.signal);
        if (!controller.signal.aborted) setGoal(result);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.errorCode === "sponsorship_goal_not_found") {
          setGoalMissing(true);
        }
      }
    })();
    return () => controller.abort();
  }, [accessToken, id]);

  const notFound = goalMissing || failure === "goal_not_found";

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <Link
            href="/employer/sponsorship"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Sponsorship goals
          </Link>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Matching clubs
          </h1>
          {goal ? (
            <p className="mt-2 break-words text-sm text-muted-foreground sm:text-base">
              <span className="font-medium text-foreground">{goal.name}</span>
              {" · "}
              {goal.companyName}
            </p>
          ) : null}
        </div>

        {notFound ? (
          <SponsorshipEmptyState
            title="Goal set not found"
            message="It may have been deleted. Go back to your goal sets."
          />
        ) : (
          <>
            <MatchSearchBox
              id="goal-matches-search"
              label="Describe the club you want, in your own words"
              placeholder="Hackathon, computer science, year 2"
              value={text}
              onChange={setText}
              error={failure === "query_invalid" ? messageForMatchFailure(failure) : null}
            />
            <MatchResults
              items={items}
              failure={failure}
              loading={loading}
              query={query}
              onRetry={retry}
              onClear={() => setText("")}
              what="clubs"
              emptySuggestions="Clubs show up here once they publish a profile that fits this goal set."
              getKey={(m) => m.club.id}
              renderItem={(m) => <ClubMatchCard match={m} />}
            />
          </>
        )}
      </div>
    </div>
  );
}
