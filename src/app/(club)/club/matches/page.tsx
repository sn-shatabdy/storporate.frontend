"use client";

import Link from "next/link";

import { listCompanyMatches } from "@/lib/api/matching";
import { Button } from "@/components/ui/button";
import { CompanyMatchCard } from "@/components/matching/company-match-card";
import { MatchResults } from "@/components/matching/match-results";
import { MatchSearchBox } from "@/components/matching/match-search-box";
import { messageForMatchFailure } from "@/components/matching/matching-helpers";
import { useMatchResults } from "@/components/matching/use-match-results";
import { SponsorshipEmptyState } from "@/components/sponsorship/sponsorship-pieces";

const load = (token: string, q: string, signal: AbortSignal) =>
  listCompanyMatches(token, q, signal);

/** `/club/matches`: companies whose goals fit the club. The (club) layout owns
 *  the authorization gate. */
export default function ClubMatchesPage() {
  const { text, setText, query, items, loading, failure, retry } = useMatchResults(load);

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Companies that fit your club
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Suggestions from your profile, best fit first.
          </p>
        </div>

        {failure === "profile_not_found" ? (
          <SponsorshipEmptyState
            title="No club profile yet."
            message="Matches are based on your club profile."
            action={<ProfileButton label="Build your club profile to see matches" />}
          />
        ) : failure === "profile_not_published" ? (
          <SponsorshipEmptyState
            title="Your profile is a draft."
            message="Only published profiles are matched. Yours is still a draft."
            action={<ProfileButton label="Publish your profile to see matches" />}
          />
        ) : (
          <>
            <MatchSearchBox
              id="club-matches-search"
              label="Search in your own words"
              placeholder="Need sponsor for a career fair"
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
              what="companies"
              emptySuggestions="Companies show up here when they share goals that fit your club."
              getKey={(m) => m.company.id}
              renderItem={(m) => <CompanyMatchCard match={m} />}
            />
          </>
        )}
      </div>
    </div>
  );
}

function ProfileButton({ label }: { label: string }) {
  return (
    <Button asChild size="lg" className="mt-1 h-10 px-4 sm:h-9">
      <Link href="/club/profile">{label}</Link>
    </Button>
  );
}
