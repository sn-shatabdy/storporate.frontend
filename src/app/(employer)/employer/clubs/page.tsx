"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Search } from "lucide-react";

import { listClubs, type ClubFilters, type ClubSummary } from "@/lib/api/clubs";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { ClubsEmptyState } from "@/components/clubs/clubs-empty-state";
import { initialsOf, pluralize } from "@/components/clubs/club-helpers";

const DEBOUNCE_MS = 350;
const PILLS_SHOWN = 3;
const LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

/** `/employer/clubs`: published club profiles. The (employer) layout owns the
 *  authorization gate. */
export default function EmployerClubsPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [q, setQ] = useState("");
  const [field, setField] = useState("");
  const [university, setUniversity] = useState("");
  const [filters, setFilters] = useState<ClubFilters>({});
  const [items, setItems] = useState<ClubSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((prev) => {
          const next = {
            q: q.trim(),
            field: field.trim(),
            university: university.trim(),
          };
          const same =
            (prev.q ?? "") === next.q &&
            (prev.field ?? "") === next.field &&
            (prev.university ?? "") === next.university;
          return same ? prev : next;
        }),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [q, field, university]);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const result = await listClubs(accessToken, filters, controller.signal);
        if (controller.signal.aborted) return;
        setItems(result.items);
        setLoading(false);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [accessToken, filters, version]);

  const hasFilters = Boolean(q.trim() || field.trim() || university.trim());

  function clearFilters() {
    setQ("");
    setField("");
    setUniversity("");
  }

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Clubs
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            University clubs and the students they reach.
          </p>
        </div>

        <div
          role="search"
          className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clubs-search" className={LABEL}>
              Search
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="clubs-search"
                type="search"
                value={q}
                placeholder="Club name or topic"
                className="pl-8"
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
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
                onChange={(e) => setField(e.target.value)}
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
                onChange={(e) => setUniversity(e.target.value)}
              />
            </div>
          </div>
        </div>

        {failed && items === null ? (
          <AdvisorErrorState
            title="Could not load clubs"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : items === null ? (
          <JobsListSkeleton label="Loading clubs." />
        ) : (
          <>
            {failed ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border bg-[#fbe9e7] p-4 text-sm text-foreground"
                style={{ borderColor: "rgba(179,38,30,0.25)" }}
              >
                <span>Could not update the list. Check your connection and try again.</span>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-9 bg-white"
                  onClick={() => setVersion((v) => v + 1)}
                >
                  Try again
                </Button>
              </div>
            ) : null}
            {items.length === 0 ? (
              <ClubsEmptyState
                title="No clubs match."
                message={
                  hasFilters
                    ? "Try a different search or clear the filters."
                    : "Clubs show up here once they publish a profile."
                }
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
              <ul
                className="flex flex-col gap-3"
                aria-busy={loading}
                aria-label="Clubs"
              >
                {items.map((club) => (
                  <li key={club.id}>
                    <ClubCard club={club} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ClubCard({ club }: { club: ClubSummary }) {
  const shown = club.fieldsOfStudy.slice(0, PILLS_SHOWN);
  const rest = club.fieldsOfStudy.length - shown.length;
  return (
    <Link
      href={`/employer/clubs/${encodeURIComponent(club.id)}`}
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
          {initialsOf(club.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div>
            <h2 className="break-words font-heading text-lg font-semibold leading-snug text-foreground">
              {club.name}
            </h2>
            {club.tagline ? (
              <p className="mt-0.5 text-sm text-foreground">{club.tagline}</p>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">
              {club.university} · {pluralize(club.memberCount, "member", "members")}
            </p>
          </div>
          {shown.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-1.5" aria-label="Fields of study">
              {shown.map((f) => (
                <li key={f}>
                  <span
                    className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold sm:px-2.5 sm:text-[11px]"
                    style={{ backgroundColor: "var(--accent)", color: "#345a73" }}
                  >
                    {f}
                  </span>
                </li>
              ))}
              {rest > 0 ? (
                <li>
                  <span className="inline-flex items-center rounded-full bg-muted px-[9px] py-[3px] text-[10.5px] font-semibold text-muted-foreground sm:px-2.5 sm:text-[11px]">
                    +{rest} more
                  </span>
                </li>
              ) : null}
            </ul>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {pluralize(club.eventCount, "event", "events")}
          </p>
        </div>
      </article>
    </Link>
  );
}
