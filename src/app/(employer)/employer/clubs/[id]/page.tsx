"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, Send } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  getClub,
  type ClubEventAttendanceSummary,
  type ClubProfileResponse,
} from "@/lib/api/clubs";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { ClubProfileView } from "@/components/clubs/club-profile-view";
import { ClubsEmptyState } from "@/components/clubs/clubs-empty-state";
import { Button } from "@/components/ui/button";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; club: ClubProfileResponse }
  | { kind: "notFound" }
  | { kind: "error" };

const LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

/** STOR-69 Phase 3 — `/employer/clubs/{id}`: published club detail.
 *  Implements the approved `Desktop-02-Detail.dc.html` canvas. The left
 *  column reuses the shared `ClubProfileView` (already designed in Phase 2
 *  for the builder preview) so the same module renders for both surfaces
 *  without duplication. The right column adds the new "Key facts" panel
 *  with attendance range plus the "Send a sponsorship request" primary
 *  action — STOR-72 wires that button to its endpoint. */
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
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
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
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <ClubProfileView profile={state.club} />
            </div>
            <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-[340px]">
              <KeyFactsPanel club={state.club} />
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

/** The right-rail "Key facts" card. The Members/Founded rows mirror the
 *  header on the existing `ClubProfileView`, but having them as a sticky
 *  rail keeps the action button visible while the reader scrolls through
 *  About / Audience / Events. The attendance range is sourced from the
 *  enriched browse summary, recomputed here from the club's events to keep
 *  the detail page self-sufficient. */
function KeyFactsPanel({ club }: { club: ClubProfileResponse }) {
  const summary = summarizeAttendance(club.events);
  const attendance = formatAttendanceRange(summary);
  return (
    <section
      aria-labelledby="club-key-facts"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      style={{ borderColor: "var(--border)" }}
    >
      <h2 id="club-key-facts" className="font-heading text-lg font-semibold text-foreground">
        Key facts
      </h2>
      <dl className="flex flex-col gap-2.5 text-sm">
        <FactRow label="Members" value={club.memberCount.toLocaleString("en-US")} />
        <FactRow
          label="Founded"
          value={club.foundedYear === null ? "Not listed yet." : String(club.foundedYear)}
        />
        <FactRow label="Attendance range" value={attendance ?? "Not listed yet."} />
      </dl>
      <Button
        type="button"
        className="mt-2 w-full"
        data-testid="sponsor-cta"
      >
        <Send className="size-4" aria-hidden />
        Send a sponsorship request
      </Button>
    </section>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={LABEL}>{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function summarizeAttendance(
  events: readonly { typicalAttendance: number }[],
): ClubEventAttendanceSummary {
  if (events.length === 0) return { min: null, max: null };
  let min = events[0].typicalAttendance;
  let max = min;
  for (const e of events) {
    if (e.typicalAttendance < min) min = e.typicalAttendance;
    if (e.typicalAttendance > max) max = e.typicalAttendance;
  }
  return { min, max };
}

function formatAttendanceRange(s: ClubEventAttendanceSummary): string | null {
  if (s.min === null && s.max === null) return null;
  if (s.min === s.max) return String(s.min);
  if (s.min === null) return String(s.max);
  if (s.max === null) return String(s.min);
  return `${s.min}-${s.max}`;
}
