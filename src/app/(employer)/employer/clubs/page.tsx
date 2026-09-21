"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import {
  listClubs,
  type ClubEventAttendanceSummary,
  type ClubSummary,
} from "@/lib/api/clubs";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { ClubsEmptyState } from "@/components/clubs/clubs-empty-state";
import { initialsOf, pluralize } from "@/components/clubs/club-helpers";

const DEBOUNCE_MS = 350;
const MAX_LIST = 50;

const LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

type LoadState = {
  items: ClubSummary[];
  total: number;
} | null;
type Failure =
  | { kind: "fatal" }
  | { kind: "refresh" };

/** STOR-69 Phase 3 — `/employer/clubs`: published club profiles.
 *  Implements the approved employer-side browse design with the Phase 1
 *  enriched summary (`foundedYear`, `audienceYears`, `eventAttendanceSummary`,
 *  `supportNeeds`) and the `total` affordance so the caller knows when the
 *  server-side cap was hit.
 *
 *  Filters behave like the previous build: one search input and one each for
 *  field of study and university, all debounced against the live endpoint.
 *  The visual treatment (label row, card content, "View profile" primary,
 *  and the centered hint under the grid) is transcribed from the approved
 *  `Main.dc.html` and `Phone-01-List.dc.html` canvases. */
export default function EmployerClubsPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [q, setQ] = useState("");
  const [field, setField] = useState("");
  const [university, setUniversity] = useState("");
  const [state, setState] = useState<LoadState>(null);
  const [everLoaded, setEverLoaded] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [version, setVersion] = useState(0);

  const filters = useMemo(
    () => ({
      q: q.trim(),
      field: field.trim(),
      university: university.trim(),
    }),
    [q, field, university],
  );

  const hasFilters =
    filters.q.length > 0 || filters.field.length > 0 || filters.university.length > 0;

  // Wait for a pause in typing before asking the server. The fetch effect
  // below only depends on `[accessToken, version]`, so debouncing only has
  // one knob to flip — `version`. Empty values are dropped from the URL by
  // `listClubs`, so the wire request stays small.
  useEffect(() => {
    const timer = setTimeout(() => setVersion((v) => v + 1), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters]);

  // Fetch effect. Failure shape (fatal card vs. in-list banner) is picked
  // by inspecting `everLoaded` at catch time: if we have never shown any
  // items yet, the page cannot display a stale list so we replace it with
  // the full-page error card. After the first successful load, transient
  // errors become the less disruptive banner.
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      try {
        const result = await listClubs(accessToken, filters, controller.signal);
        if (controller.signal.aborted) return;
        setState({ items: result.items, total: result.total });
        setEverLoaded(true);
        setFailure(null);
      } catch {
        if (controller.signal.aborted) return;
        if (!everLoaded) {
          setFailure({ kind: "fatal" });
          setState(null);
        } else {
          setFailure((prev) => prev ?? { kind: "refresh" });
        }
      }
    })();
    return () => controller.abort();
    // `everLoaded` is read at catch time to choose the failure shape; adding
    // it to the deps would re-fire the fetch every time it flips. The
    // exhaustive-deps linter would flag that as the larger mistake.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, version]);

  function clearFilters() {
    setQ("");
    setField("");
    setUniversity("");
  }

  // Empty-result copy mirrors the design: nothing here yet vs. nothing matches
  // these filters (with a Clear filters action when the latter is the case).
  function emptyTitle(): string {
    return "No clubs match.";
  }
  function emptyMessage(): string {
    return hasFilters
      ? "Try a different search or clear the filters."
      : "Clubs show up here once they publish a profile.";
  }

  if (failure?.kind === "fatal" && state === null) {
    return (
      <PageShell>
        <Header />
        <AdvisorErrorState
          title="Could not load clubs"
          message="Check your connection and try again."
          onRetry={() => setVersion((v) => v + 1)}
        />
      </PageShell>
    );
  }

  if (state === null) {
    return (
      <PageShell>
        <Header />
        <FilterRow
          q={q}
          field={field}
          university={university}
          onQChange={setQ}
          onFieldChange={setField}
          onUniversityChange={setUniversity}


        />
        <JobsListSkeleton label="Loading clubs." />
      </PageShell>
    );
  }

  const { items, total } = state;

  return (
    <PageShell>
      <Header />
      <FilterRow
        q={q}
        field={field}
        university={university}
        onQChange={setQ}
        onFieldChange={setField}
        onUniversityChange={setUniversity}
      />

      {items.length > 0 ? (
        <p
          aria-live="polite"
          className="text-sm text-muted-foreground"
          data-testid="clubs-count"
        >
          <CountLine shown={items.length} total={total} />
        </p>
      ) : null}

      {failure?.kind === "refresh" ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <span>Could not update the list. Check your connection and try again.</span>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-9"
            onClick={() => setVersion((v) => v + 1)}
          >
            Try again
          </Button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <ClubsEmptyState
          title={emptyTitle()}
          message={emptyMessage()}
          action={
            hasFilters ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="mt-1 h-10 sm:h-9"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul
            data-testid="clubs-list"
            aria-label="Clubs"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((club) => (
              <li key={club.id}>
                <ClubCard club={club} />
              </li>
            ))}
          </ul>
          <p className="mx-auto max-w-[520px] text-center text-sm text-muted-foreground">
            Showing the newest {pluralize(Math.min(total, MAX_LIST), "published club", "published clubs")}.
            Narrow your search to see more specific matches.
          </p>
        </>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">{children}</div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Clubs
      </h1>
      <p className="mt-2 text-sm text-muted-foreground sm:text-base">
        Browse published clubs to find a sponsorship fit.
      </p>
    </div>
  );
}

function FilterRow({
  q,
  field,
  university,
  onQChange,
  onFieldChange,
  onUniversityChange,
}: {
  q: string;
  field: string;
  university: string;
  onQChange: (v: string) => void;
  onFieldChange: (v: string) => void;
  onUniversityChange: (v: string) => void;
}) {
  return (
    <div
      role="search"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="clubs-search" className={LABEL}>
          Search
        </label>
        <Input
          id="clubs-search"
          type="search"
          value={q}
          placeholder="Search clubs, e.g. robotics"
          onChange={(e) => onQChange(e.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="clubs-field" className={LABEL}>
            Field of study
          </label>
          <Input
            id="clubs-field"
            value={field}
            placeholder="Computer Science"
            onChange={(e) => onFieldChange(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="clubs-university" className={LABEL}>
            University
          </label>
          <Input
            id="clubs-university"
            value={university}
            placeholder="BUET"
            onChange={(e) => onUniversityChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

/** "Showing 50 of 63 clubs". Skips the second clause when nothing was
 *  truncated. */
function CountLine({ shown, total }: { shown: number; total: number }) {
  if (total > shown) {
    return <span>Showing {shown} of {total} clubs.</span>;
  }
  return <span>Showing {shown} {shown === 1 ? "club" : "clubs"}.</span>;
}

const ACCENT_CHIP =
  "inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-semibold";

function ClubCard({ club }: { club: ClubSummary }) {
  const summary = club.eventAttendanceSummary;
  const yearsLabel = formatYearsRange(club.audienceYears);
  const attendanceLabel = formatAttendanceRange(summary);
  return (
    <Link
      href={`/employer/clubs/${encodeURIComponent(club.id)}`}
      data-testid="club-card-link"
      className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      aria-label={`View profile of ${club.name}`}
    >
      <article
        className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
        style={{ borderColor: "var(--border)" }}
      >
        <header className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-base font-semibold text-primary"
          >
            {initialsOf(club.name)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="break-words font-heading text-lg font-semibold leading-snug text-foreground">
              {club.name}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {club.university}
            </p>
          </div>
        </header>

        {club.tagline ? (
          <p className="line-clamp-2 text-sm leading-6 text-foreground">
            {club.tagline}
          </p>
        ) : null}

        <ul
          className="flex flex-wrap gap-1.5"
          aria-label="At a glance"
        >
          <li>
            <span className={`${ACCENT_CHIP} bg-secondary text-foreground`}>
              {pluralize(club.memberCount, "member", "members")}
            </span>
          </li>
          {club.foundedYear !== null ? (
            <li>
              <span
                className={`${ACCENT_CHIP} bg-secondary text-foreground`}
                data-testid="club-founded"
              >
                Founded {club.foundedYear}
              </span>
            </li>
          ) : null}
          {yearsLabel ? (
            <li>
              <span
                className={`${ACCENT_CHIP} bg-accent text-primary`}
                data-testid="club-years"
              >
                Years {yearsLabel}
              </span>
            </li>
          ) : null}
          {attendanceLabel ? (
            <li>
              <span
                className={`${ACCENT_CHIP} bg-accent text-primary`}
                data-testid="club-attendance"
              >
                Attendance {attendanceLabel}
              </span>
            </li>
          ) : null}
        </ul>

        {club.supportNeeds.length > 0 ? (
          <p
            className="text-xs text-muted-foreground"
            data-testid="club-needs"
          >
            Needs: {club.supportNeeds.join(", ")}
          </p>
        ) : null}

        <Button asChild size="default" className="mt-auto">
          <span>View profile</span>
        </Button>
      </article>
    </Link>
  );
}

/** Years 2–4 (en-dash replacement: hyphen for plain text), Years 2 (single),
 *  Years 2, 3, 4 (unordered, multi). `null` when no years are listed. */
function formatYearsRange(years: readonly number[]): string | null {
  if (years.length === 0) return null;
  const sorted = [...years].sort((a, b) => a - b);
  // Detect a contiguous range like [2,3,4] -> "2-4".
  const isContiguous =
    sorted.length >= 2 &&
    sorted.every((y, i) => i === 0 || y === sorted[i - 1] + 1);
  if (isContiguous) {
    return `${sorted[0]}-${sorted[sorted.length - 1]}`;
  }
  return sorted.join(", ");
}

/** "40-180" (range), "80" (single), `null` when no attendance data. */
function formatAttendanceRange(s: ClubEventAttendanceSummary): string | null {
  if (s.min === null && s.max === null) return null;
  if (s.min === s.max) return String(s.min);
  if (s.min === null) return String(s.max);
  if (s.max === null) return String(s.min);
  return `${s.min}-${s.max}`;
}
