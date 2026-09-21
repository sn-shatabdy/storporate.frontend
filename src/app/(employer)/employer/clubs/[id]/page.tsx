"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import { getClub, type ClubProfileResponse } from "@/lib/api/clubs";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { ClubProfileView } from "@/components/clubs/club-profile-view";
import { ClubsEmptyState } from "@/components/clubs/clubs-empty-state";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; club: ClubProfileResponse }
  | { kind: "notFound" }
  | { kind: "error" };

/** `/employer/clubs/{id}`: one published club profile. */
export default function EmployerClubDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;
  const id = params?.id;

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!accessToken || !id) return;
    const controller = new AbortController();
    (async () => {
      setState({ kind: "loading" });
      try {
        const club = await getClub(accessToken, id, controller.signal);
        if (controller.signal.aborted) return;
        setState({ kind: "loaded", club });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.errorCode === "club_profile_not_found") {
          setState({ kind: "notFound" });
        } else {
          setState({ kind: "error" });
        }
      }
    })();
    return () => controller.abort();
  }, [accessToken, id, version]);

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <Link
            href="/employer/clubs"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Clubs
          </Link>
        </div>

        {state.kind === "loading" ? (
          <JobsListSkeleton label="Loading the club profile." />
        ) : state.kind === "notFound" ? (
          <ClubsEmptyState
            title="This club profile is not available."
            message="It may have been unpublished. Go back to the club list."
          />
        ) : state.kind === "error" ? (
          <AdvisorErrorState
            title="Could not load this club"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : (
          <ClubProfileView profile={state.club} />
        )}
      </div>
    </div>
  );
}
