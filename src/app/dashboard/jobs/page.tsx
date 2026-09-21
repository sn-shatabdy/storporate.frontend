"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Search } from "lucide-react";

import {
  listJobs,
  type JobWithFit,
  type PostingKind,
  type WorkMode,
} from "@/lib/api/jobPostings";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import {
  FitPill,
  KindPill,
  truncatedList,
  workModeAndLocation,
} from "@/components/jobs/job-pills";
import { JobsEmptyState, JobsListSkeleton } from "@/components/jobs/job-states";
import { SegmentedControl } from "@/components/jobs/segmented-control";

type KindFilter = "All" | PostingKind;
type ModeFilter = "All" | WorkMode;

const SEARCH_DEBOUNCE_MS = 350;

/** `/dashboard/jobs`: browse Open jobs and internships with a fit summary. */
export default function OpeningsPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("All");
  const [workMode, setWorkMode] = useState<ModeFilter>("All");

  const [items, setItems] = useState<JobWithFit[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const result = await listJobs(
          accessToken,
          {
            kind: kind === "All" ? undefined : kind,
            workMode: workMode === "All" ? undefined : workMode,
            q: debouncedQuery || undefined,
          },
          controller.signal,
        );
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
  }, [accessToken, kind, workMode, debouncedQuery, version]);

  const filtersActive = kind !== "All" || workMode !== "All" || query.trim() !== "";

  function clearFilters() {
    setQuery("");
    setDebouncedQuery("");
    setKind("All");
    setWorkMode("All");
  }

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Openings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Jobs and internships from employers, with how your skills fit each one.
          </p>
        </div>

        <div
          className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
          style={{ borderColor: "var(--border)" }}
          role="search"
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              aria-label="Search openings"
              placeholder="Search by title, company or skill"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl<KindFilter>
              name="openings-kind"
              legend="Kind"
              value={kind}
              onChange={setKind}
              options={[
                { value: "All", label: "All" },
                { value: "Job", label: "Job" },
                { value: "Internship", label: "Internship" },
              ]}
            />
            <select
              aria-label="Work mode"
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value as ModeFilter)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:w-44"
            >
              <option value="All">Any work mode</option>
              <option value="OnSite">On site</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
        </div>

        {failed && items === null ? (
          <AdvisorErrorState
            title="Could not load openings"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : items === null ? (
          <JobsListSkeleton label="Loading openings." />
        ) : (
          <>
            {failed ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                Could not refresh the list.{" "}
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => setVersion((v) => v + 1)}
                >
                  Try again
                </button>
              </p>
            ) : null}
            {items.length === 0 ? (
              filtersActive ? (
                <JobsEmptyState
                  title="No openings match"
                  message="Try different words, or clear the filters."
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="mt-1 h-9"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <JobsEmptyState
                  title="No openings yet"
                  message="Employers have not posted anything right now. Check back soon."
                />
              )
            ) : (
              <div className="flex flex-col gap-3" aria-busy={loading}>
                <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
                  {items.length === 1 ? "1 opening" : `${items.length} openings`}
                </p>
                <ul
                  className={`flex flex-col gap-3 transition-opacity ${loading ? "opacity-60" : ""}`}
                >
                  {items.map((job) => (
                    <li key={job.id}>
                      <OpeningCard job={job} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function OpeningCard({ job }: { job: JobWithFit }) {
  const have = job.fit.matched.map((m) => m.name);
  return (
    <article
      className="relative flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring/40 hover:bg-[#fffdf6]"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold leading-snug text-foreground">
            <Link
              href={`/dashboard/jobs/${encodeURIComponent(job.id)}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl"
            >
              {job.title}
            </Link>
          </h2>
          <p className="mt-0.5 text-sm text-foreground">{job.companyName}</p>
        </div>
        <FitPill label={job.fit.label} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <KindPill kind={job.kind} />
        <span className="text-sm text-muted-foreground">
          {workModeAndLocation(job.workMode, job.location)}
        </span>
      </div>
      {have.length > 0 || job.fit.missing.length > 0 ? (
        <div className="flex flex-col gap-1 text-[13px] leading-5">
          {have.length > 0 ? (
            <p className="text-foreground">
              <span className="font-semibold">You have:</span>{" "}
              {truncatedList(have)}
            </p>
          ) : null}
          {job.fit.missing.length > 0 ? (
            <p className="text-muted-foreground">
              <span className="font-semibold">To build:</span>{" "}
              {truncatedList(job.fit.missing)}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
