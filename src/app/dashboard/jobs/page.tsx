"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Banknote, Building2, ChevronDown, Loader2, MapPin, Plus, Search, Users, X } from "lucide-react";

import {
  listJobs,
  type JobWithFit,
  type PostingKind,
  type WorkMode,
} from "@/lib/api/jobPostings";
import { Button } from "@/components/ui/button";
import {
  AppliedPill,
  DeadlineChip,
  FitPill,
  formatOpenings,
  formatPayRange,
  formatPostedDate,
  HaveSkillChip,
  KindPill,
  ToBuildSkillChip,
  workModeAndLocation,
} from "@/components/jobs/job-pills";
import {
  JobsListSkeleton,
  OpeningsEmptyState,
  OpeningsErrorState,
  OpeningsNoMatch,
  OpeningsRefetchIndicator,
} from "@/components/jobs/job-states";
import { SegmentedControl } from "@/components/jobs/segmented-control";

import { cn } from "cn";

type KindFilter = "All" | PostingKind;
type ModeFilter = "All" | WorkMode;
type SortMode = "fit" | "newest";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;
const SKILL_CHIP_LIMIT = 3;

/** `/dashboard/jobs`: browse Open jobs and internships with a per-student
 *  fit summary. Wired to the Phase 1 backend contract:
 *  `GET /api/discovery/jobs?kind=&workMode=&q=&sort=&page=&pageSize=`. */
export default function OpeningsPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("All");
  const [workMode, setWorkMode] = useState<ModeFilter>("All");
  const [sort, setSort] = useState<SortMode>("fit");

  const [items, setItems] = useState<JobWithFit[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refetching, setRefetching] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  // First-page fetch — replaces items, runs whenever any filter changes.
  // The fetch logic is wrapped in useCallback so the lint rule that bans
  // setState directly in an effect body treats the call site like the
  // audit-log pattern: a small effect only kicks off the async fn.
  const hasItems = useRef(false);
  const fetchFirstPage = useCallback(
    async (signal: AbortSignal) => {
      const firstLoad = !hasItems.current;
      try {
        const result = await listJobs(
          accessToken!,
          {
            kind: kind === "All" ? undefined : kind,
            workMode: workMode === "All" ? undefined : workMode,
            q: debouncedQuery || undefined,
            sort,
            page: 1,
            pageSize: PAGE_SIZE,
          },
          signal,
        );
        if (signal.aborted) return;
        setItems(result.items);
        setTotal(result.total);
        setPage(1);
        hasItems.current = true;
      } catch {
        if (signal.aborted) return;
        setFailed(true);
      } finally {
        if (!signal.aborted) {
          setLoading(false);
          setRefetching(false);
        }
      }
      return firstLoad;
    },
    [accessToken, kind, workMode, debouncedQuery, sort],
  );

  // `version` is the manual retry counter — bumping it forces a fresh
  // fetch without changing the filter deps.
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    // Standard data-fetching pattern: flip spinner/error flags
    // synchronously to reflect the in-flight request. The lint rule
    // treats this as the same "known error" pattern used in
    // audit-log/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setFailed(false);
    setLoadMoreError(false);
    if (hasItems.current) setRefetching(true);
    void fetchFirstPage(controller.signal);
    return () => controller.abort();
  }, [accessToken, fetchFirstPage, version]);

  const filtersActive =
    kind !== "All" || workMode !== "All" || query.trim() !== "";

  const canLoadMore = useMemo(() => {
    if (total === null) return false;
    return page * PAGE_SIZE < total;
  }, [page, total]);

  async function loadMore() {
    if (!accessToken || !canLoadMore || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    const next = page + 1;
    const controller = new AbortController();
    try {
      const result = await listJobs(
        accessToken,
        {
          kind: kind === "All" ? undefined : kind,
          workMode: workMode === "All" ? undefined : workMode,
          q: debouncedQuery || undefined,
          sort,
          page: next,
          pageSize: PAGE_SIZE,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setItems((prev) => [...prev, ...result.items]);
      setTotal(result.total);
      setPage(next);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function clearFilters() {
    setQuery("");
    setDebouncedQuery("");
    setKind("All");
    setWorkMode("All");
  }

  function removeChip(remove: "kind" | "mode") {
    if (remove === "kind") setKind("All");
    else setWorkMode("All");
  }

  const count = items.length;
  const totalShown = total ?? count;
  const showingText = `${count} of ${totalShown} ${totalShown === 1 ? "opening" : "openings"}`;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-5">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-[36px]">
            Openings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Jobs and internships, ordered by how well they fit what you can already do.
          </p>
        </div>

        {/* Filter bar */}
        <section
          role="search"
          aria-label="Filter openings"
          className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5"
          style={{ borderColor: "var(--border)" }}
        >
          <label className="relative block">
            <span className="sr-only">Search openings</span>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by role, company or skill"
              className="h-[46px] w-full rounded-[10px] border border-border bg-background pl-11 pr-3.5 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-1">
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
              <SegmentedControl<ModeFilter>
                name="openings-mode"
                legend="Work mode"
                value={workMode}
                onChange={setWorkMode}
                options={[
                  { value: "All", label: "All" },
                  { value: "OnSite", label: "On-site" },
                  { value: "Remote", label: "Remote" },
                  { value: "Hybrid", label: "Hybrid" },
                ]}
              />
            </div>
            <SortSelect value={sort} onChange={setSort} />
          </div>
        </section>

        {/* Active-filter chips + result count. The aria-live count lives
            only in this top strip when the items list is fully shown
            (no Load more) — when more pages remain it moves next to the
            Load more button below, so screen readers never announce the
            same number twice for the same render. */}
        {(filtersActive || (items.length > 0 && !canLoadMore)) && !loading ? (
          <div className="flex flex-col gap-3">
            {filtersActive ? (
              <div className="flex flex-wrap items-center gap-2">
                {kind !== "All" ? (
                  <FilterChip
                    label={kind}
                    onRemove={() => removeChip("kind")}
                  />
                ) : null}
                {workMode !== "All" ? (
                  <FilterChip
                    label={workModeToLabel(workMode)}
                    onRemove={() => removeChip("mode")}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex h-8 items-center px-2 text-[14px] font-bold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  Clear all
                </button>
              </div>
            ) : null}
            {items.length > 0 && !canLoadMore ? (
              <p
                role="status"
                aria-live="polite"
                className="text-[14px] font-medium text-muted-foreground"
              >
                {showingText}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Page-level states */}
        {loading && items.length === 0 ? (
          <JobsListSkeleton label="Loading openings." />
        ) : failed && items.length === 0 ? (
          <OpeningsErrorState onRetry={() => setVersion((v) => v + 1)} />
        ) : items.length === 0 ? (
          filtersActive ? (
            <OpeningsNoMatch onClearFilters={clearFilters} />
          ) : (
            <OpeningsEmptyState />
          )
        ) : (
          <>
            {refetching ? <OpeningsRefetchIndicator /> : null}
            <ul className="flex flex-col gap-4" aria-busy={refetching}>
              {items.map((job) => (
                <li key={job.id}>
                  <OpeningCard job={job} />
                </li>
              ))}
            </ul>
            {canLoadMore ? (
              <div className="flex flex-col items-center gap-2.5 pt-1">
                <p
                  role="status"
                  aria-live="polite"
                  className="text-[14px] font-medium text-muted-foreground"
                >
                  {showingText}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-12 w-full border-[1.5px] border-primary px-4 text-primary sm:w-auto"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  aria-busy={loadingMore}
                >
                  {loadingMore ? (
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden
                    />
                  ) : (
                    <Plus className="size-4" aria-hidden />
                  )}
                  {loadingMore ? "Loading more…" : "Load more openings"}
                </Button>
                {loadMoreError ? (
                  <p
                    role="alert"
                    className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-danger"
                  >
                    Could not load more openings.
                    <button
                      type="button"
                      onClick={() => void loadMore()}
                      className="underline underline-offset-2"
                    >
                      Try again
                    </button>
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function workModeToLabel(mode: WorkMode): string {
  switch (mode) {
    case "OnSite":
      return "On-site";
    case "Remote":
      return "Remote";
    case "Hybrid":
      return "Hybrid";
  }
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-[13px] font-bold text-info">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label} filter`}
        onClick={onRemove}
        className="inline-flex size-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        style={{ backgroundColor: "rgba(52,90,115,0.14)" }}
      >
        <X className="size-3 text-info" strokeWidth={2.5} aria-hidden />
      </button>
    </span>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: SortMode;
  onChange: (next: SortMode) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
        Sort by
      </span>
      <span className="relative inline-flex">
        <select
          aria-label="Sort openings"
          value={value}
          onChange={(e) => onChange(e.target.value as SortMode)}
          className="h-10 min-w-[150px] appearance-none rounded-[10px] border border-border bg-background px-3.5 pr-9 text-[14px] font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <option value="fit">Best fit</option>
          <option value="newest">Newest</option>
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
      </span>
    </label>
  );
}

function OpeningCard({ job }: { job: JobWithFit }) {
  const have = job.fit.matched.map((m) => m.name);
  const toBuild = job.fit.missing;
  const haveShown = have.slice(0, SKILL_CHIP_LIMIT);
  const haveRest = have.length - haveShown.length;
  const toBuildShown = toBuild.slice(0, SKILL_CHIP_LIMIT);
  const toBuildRest = toBuild.length - toBuildShown.length;
  const posted = formatPostedDate(job.createdAt);
  const pay = job.compensation
    ? formatPayRange(job.compensation.min, job.compensation.max, "per month")
    : null;
  const showPay = pay !== null;
  const location = job.location?.trim() ?? "";
  const workModeLabel =
    job.workMode === "OnSite" ? "On-site" : job.workMode;

  return (
    <article
      className="relative flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring/40 hover:bg-accent sm:p-6"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <FitPill label={job.fit.label} />
          <KindPill kind={job.kind} />
          <span className="inline-flex items-center whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-[12px] font-bold text-muted-foreground">
            {workModeLabel}
          </span>
          {job.application ? <AppliedPill /> : null}
        </div>
        {posted ? (
          <span className="text-[13px] font-medium text-muted-foreground">
            Posted {posted}
          </span>
        ) : null}
      </div>
      <h2 className="font-heading text-[20px] font-semibold leading-snug text-foreground sm:text-[22px]">
        <Link
          href={`/dashboard/jobs/${encodeURIComponent(job.id)}`}
          className="outline-none after:absolute after:inset-0 after:rounded-2xl"
        >
          {job.title}
        </Link>
      </h2>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Meta icon={<Building2 className="size-4" aria-hidden />}>{job.companyName}</Meta>
        <Meta icon={<MapPin className="size-4" aria-hidden />}>
          {location ? workModeAndLocation(job.workMode, job.location) : workModeLabel}
        </Meta>
        <DeadlineChip iso={job.applicationDeadline ?? null} />
        <Meta icon={<Users className="size-4" aria-hidden />}>
          {formatOpenings(job.openings)}
        </Meta>
        {showPay ? (
          <Meta icon={<Banknote className="size-4" aria-hidden />}>{pay}</Meta>
        ) : null}
      </div>
      {(have.length > 0 || toBuild.length > 0) ? (
        <div
          className={cn("flex flex-col gap-2 border-t pt-3")}
          style={{ borderColor: "var(--border)" }}
        >
          {have.length > 0 ? (
            <SkillRow label="You have">
              {haveShown.map((name) => (
                <HaveSkillChip key={`h-${name}`} name={name} />
              ))}
              {haveRest > 0 ? (
                <span className="text-[13px] font-semibold text-muted-foreground">
                  +{haveRest} more
                </span>
              ) : null}
            </SkillRow>
          ) : null}
          {toBuild.length > 0 ? (
            <SkillRow label="To build">
              {toBuildShown.map((name) => (
                <ToBuildSkillChip key={`t-${name}`} name={name} />
              ))}
              {toBuildRest > 0 ? (
                <span className="text-[13px] font-semibold text-muted-foreground">
                  +{toBuildRest} more
                </span>
              ) : null}
            </SkillRow>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Meta({
  icon,
  children,
  className,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[14px] text-muted-foreground",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function SkillRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="min-w-[74px] text-[13px] font-bold text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
