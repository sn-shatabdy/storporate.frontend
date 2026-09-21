"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, Plus } from "lucide-react";

import {
  listMyApplications,
  type ApplicationResponse,
} from "@/lib/api/jobApplications";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import {
  ApplicationStatusPill,
  FitPill,
  formatPostedDate,
  KindPill,
} from "@/components/jobs/job-pills";
import { JobsEmptyState, JobsListSkeleton } from "@/components/jobs/job-states";

const PAGE_SIZE = 20;

/** `/dashboard/applications`: every application the student has sent. */
export default function MyApplicationsPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [items, setItems] = useState<ApplicationResponse[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const hasItems = useRef(false);

  // First-page fetch — replaces items, runs on mount, retry, or paging reset.
  const fetchFirstPage = useCallback(
    async (signal: AbortSignal) => {
      try {
        const result = await listMyApplications(accessToken!, signal, {
          page: 1,
          pageSize: PAGE_SIZE,
        });
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
        }
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    // Same data-fetching pattern used in dashboard/jobs/page.tsx:
    // flip spinner/error flags synchronously to reflect the in-flight
    // request. The lint rule treats this as the same "known error"
    // pattern used in audit-log/page.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setFailed(false);
    setLoadMoreError(false);
    void fetchFirstPage(controller.signal);
    return () => controller.abort();
  }, [accessToken, fetchFirstPage, version]);

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
      const result = await listMyApplications(accessToken, controller.signal, {
        page: next,
        pageSize: PAGE_SIZE,
      });
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

  const count = items.length;
  const totalShown = total ?? count;
  const noun = totalShown === 1 ? "application" : "applications";
  const showingText = `Showing ${count} of ${totalShown} ${noun}`;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            My applications
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Openings you applied to and where each one stands.
          </p>
        </div>

        {loading && items.length === 0 ? (
          <JobsListSkeleton label="Loading your applications." />
        ) : failed && items.length === 0 ? (
          <AdvisorErrorState
            title="Could not load your applications"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : items.length === 0 ? (
          <JobsEmptyState
            title="You have not applied yet."
            message="Find an opening that fits your skills and apply in one step."
            action={
              <Button asChild size="lg" className="mt-1 h-10 px-4 sm:h-9">
                <Link href="/dashboard/jobs">Openings</Link>
              </Button>
            }
          />
        ) : (
          <>
            <p
              role="status"
              aria-live="polite"
              className="text-xs font-medium text-muted-foreground"
            >
              {showingText}
            </p>
            <ul className="flex flex-col gap-3">
              {items.map((application) => (
                <li key={application.id}>
                  <ApplicationCard application={application} />
                </li>
              ))}
            </ul>
            {canLoadMore ? (
              <div className="flex flex-col items-center gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-12 w-full border-[1.5px] border-border px-4 text-foreground sm:w-auto"
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
                  {loadingMore ? "Loading more…" : "Load more applications"}
                </Button>
                {loadMoreError ? (
                  <p
                    role="alert"
                    className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-danger"
                  >
                    Could not load more applications.
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

function ApplicationCard({ application }: { application: ApplicationResponse }) {
  const applied = formatPostedDate(application.createdAt);
  const changed =
    application.status !== "Submitted"
      ? formatPostedDate(application.statusChangedAt)
      : "";
  return (
    <article
      className="relative flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring/40 hover:bg-accent"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold leading-snug text-foreground">
            <Link
              href={`/dashboard/jobs/${encodeURIComponent(application.jobPostingId)}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl"
            >
              {application.jobTitle}
            </Link>
          </h2>
          <p className="mt-0.5 text-sm text-foreground">{application.companyName}</p>
        </div>
        <ApplicationStatusPill status={application.status} />
      </div>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <KindPill kind={application.kind} />
        <FitPill label={application.fitLabel} />
        {applied ? (
          <span className="text-xs text-muted-foreground">Applied {applied}</span>
        ) : null}
        {changed ? (
          <span className="text-xs text-muted-foreground">
            Updated {changed}
          </span>
        ) : null}
      </div>
    </article>
  );
}