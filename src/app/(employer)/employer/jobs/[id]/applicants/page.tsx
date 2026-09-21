"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, Loader2, Plus } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  getApplicant,
  listApplicants,
  setApplicantStatus,
  type ApplicantDecision,
  type ApplicantResponse,
} from "@/lib/api/jobApplications";
import {
  getMyPosting,
  type ApplicationStatus,
  type JobPosting,
} from "@/lib/api/jobPostings";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { ApplicantCard } from "@/components/jobs/applicant-card";
import { JobsEmptyState, JobsListSkeleton } from "@/components/jobs/job-states";
import { APPLICATION_STATUS_LABELS } from "@/components/jobs/job-pills";
import { SegmentedControl } from "@/components/jobs/segmented-control";
import { Button } from "@/components/ui/button";

type StatusFilter = "All" | ApplicationStatus;

const PAGE_SIZE = 20;

const FILTERS: StatusFilter[] = [
  "All",
  "Submitted",
  "Viewed",
  "Shortlisted",
  "NotSelected",
];

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; posting: JobPosting; items: ApplicantResponse[]; total: number }
  | { kind: "notFound" }
  | { kind: "error" };

/** `/employer/jobs/{id}/applicants`: who applied to one opening. The
 *  (employer) layout owns the authorization gate. */
export default function ApplicantsPage() {
  const params = useParams<{ id: string }>();
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;
  const postingId = params?.id;

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [version, setVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("All");

  const [openId, setOpenId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingDecision, setSavingDecision] = useState<ApplicantDecision | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Applicants whose detail request already ran (that request marks Viewed).
  const loadedIds = useRef<Set<string>>(new Set());

  const fetchFirstPage = useCallback(
    async (signal: AbortSignal) => {
      try {
        const [posting, list] = await Promise.all([
          getMyPosting(accessToken!, postingId!, signal),
          listApplicants(accessToken!, postingId!, signal, {
            page: 1,
            pageSize: PAGE_SIZE,
          }),
        ]);
        if (signal.aborted) return;
        loadedIds.current = new Set();
        setOpenId(null);
        setErrors({});
        setPage(1);
        setState({
          kind: "loaded",
          posting,
          items: list.items,
          total: list.total,
        });
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof ApiError && error.errorCode === "job_posting_not_found") {
          setState({ kind: "notFound" });
        } else {
          setState({ kind: "error" });
        }
      }
    },
    [accessToken, postingId],
  );

  useEffect(() => {
    if (!accessToken || !postingId) return;
    const controller = new AbortController();
    // Same data-fetching pattern as dashboard/jobs/page.tsx and
    // audit-log/page.tsx: flip the load-state synchronously to reflect
    // the in-flight request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ kind: "loading" });
    void fetchFirstPage(controller.signal);
    return () => controller.abort();
  }, [accessToken, postingId, fetchFirstPage, version]);

  async function loadMore() {
    if (!accessToken || !postingId || state.kind !== "loaded") return;
    if (loadingMore) return;
    const canLoadMore = page * PAGE_SIZE < state.total;
    if (!canLoadMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    const next = page + 1;
    const controller = new AbortController();
    try {
      const list = await listApplicants(accessToken, postingId, controller.signal, {
        page: next,
        pageSize: PAGE_SIZE,
      });
      if (controller.signal.aborted) return;
      setState((prev) =>
        prev.kind === "loaded"
          ? { ...prev, items: [...prev.items, ...list.items], total: list.total }
          : prev,
      );
      setPage(next);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const replaceApplicant = useCallback((updated: ApplicantResponse) => {
    setState((prev) =>
      prev.kind === "loaded"
        ? {
            ...prev,
            items: prev.items.map((a) => (a.id === updated.id ? updated : a)),
          }
        : prev,
    );
  }, []);

  const setError = useCallback((id: string, message: string | null) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  }, []);

  const toggle = useCallback(
    async (applicant: ApplicantResponse) => {
      if (openId === applicant.id) {
        setOpenId(null);
        return;
      }
      setOpenId(applicant.id);
      setError(applicant.id, null);
      if (!accessToken || !postingId || loadedIds.current.has(applicant.id)) return;
      setLoadingId(applicant.id);
      try {
        const detail = await getApplicant(accessToken, postingId, applicant.id);
        loadedIds.current.add(applicant.id);
        replaceApplicant(detail);
      } catch (error) {
        if (error instanceof ApiError && error.errorCode === "application_not_found") {
          setError(applicant.id, "This application is no longer available.");
        } else {
          setError(applicant.id, "Could not load the details. Hide and open to try again.");
        }
      } finally {
        setLoadingId((current) => (current === applicant.id ? null : current));
      }
    },
    [accessToken, openId, postingId, replaceApplicant, setError],
  );

  const decide = useCallback(
    async (applicant: ApplicantResponse, status: ApplicantDecision) => {
      if (!accessToken || !postingId || savingId) return;
      setSavingId(applicant.id);
      setSavingDecision(status);
      setError(applicant.id, null);
      try {
        const updated = await setApplicantStatus(
          accessToken,
          postingId,
          applicant.id,
          status,
        );
        loadedIds.current.add(applicant.id);
        replaceApplicant(updated);
      } catch {
        setError(applicant.id, "Could not save your decision. Try again.");
      } finally {
        setSavingId(null);
        setSavingDecision(null);
      }
    },
    [accessToken, postingId, replaceApplicant, savingId, setError],
  );

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
        <Link
          href="/employer/jobs"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Your openings
        </Link>

        {state.kind === "loading" ? (
          <JobsListSkeleton label="Loading applicants." />
        ) : state.kind === "notFound" ? (
          <JobsEmptyState
            title="This opening was not found"
            message="It may have been removed. Go back to your openings."
          />
        ) : state.kind === "error" ? (
          <AdvisorErrorState
            title="Could not load applicants"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Applicants
              </p>
              <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {state.posting.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">
                Everyone who applied, with how their skills fit this opening.
              </p>
            </div>

            <ApplicantList
              items={state.items}
              total={state.total}
              page={page}
              pageSize={PAGE_SIZE}
              loadingMore={loadingMore}
              loadMoreError={loadMoreError}
              filter={filter}
              onFilterChange={setFilter}
              openId={openId}
              loadingId={loadingId}
              savingId={savingId}
              savingDecision={savingDecision}
              errors={errors}
              onLoadMore={loadMore}
              onToggle={toggle}
              onDecide={decide}
            />
          </>
        )}
      </div>
    </div>
  );
}

function filterLabel(filter: StatusFilter): string {
  return filter === "All" ? "All" : APPLICATION_STATUS_LABELS[filter];
}

function ApplicantList({
  items,
  total,
  page,
  pageSize,
  loadingMore,
  loadMoreError,
  filter,
  onFilterChange,
  openId,
  loadingId,
  savingId,
  savingDecision,
  errors,
  onLoadMore,
  onToggle,
  onDecide,
}: {
  items: ApplicantResponse[];
  total: number;
  page: number;
  pageSize: number;
  loadingMore: boolean;
  loadMoreError: boolean;
  filter: StatusFilter;
  onFilterChange: (next: StatusFilter) => void;
  openId: string | null;
  loadingId: string | null;
  savingId: string | null;
  savingDecision: ApplicantDecision | null;
  errors: Record<string, string>;
  onLoadMore: () => void;
  onToggle: (a: ApplicantResponse) => void;
  onDecide: (a: ApplicantResponse, status: ApplicantDecision) => void;
}) {
  // Counts come from the loaded items — accurate when everything has been
  // paged in; partial during progressive loading. Server-side filtering is
  // out of scope for Phase 2.
  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = {
      All: items.length,
      Submitted: 0,
      Viewed: 0,
      Shortlisted: 0,
      NotSelected: 0,
    };
    for (const a of items) result[a.status] += 1;
    return result;
  }, [items]);

  // The open card stays visible even when its status changes, so it does not
  // vanish from under the employer mid-decision.
  const visible = items.filter(
    (a) => filter === "All" || a.status === filter || a.id === openId,
  );

  const canLoadMore = page * pageSize < total;

  if (items.length === 0) {
    return (
      <JobsEmptyState
        title="No applications yet."
        message="When students apply, they show up here with how they fit."
      />
    );
  }

  const options = FILTERS.map((f) => ({
    value: f,
    label: `${filterLabel(f)} (${counts[f]})`,
  }));

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<StatusFilter>
        name="applicants-status-filter"
        legend="Filter by status"
        size="md"
        options={options}
        value={filter}
        onChange={onFilterChange}
      />

      <p
        role="status"
        aria-live="polite"
        className="text-xs font-medium text-muted-foreground"
      >
        {`Showing ${items.length} of ${total} ${total === 1 ? "applicant" : "applicants"}`}
      </p>

      {visible.length === 0 ? (
        <JobsEmptyState
          title="No applications here"
          message="Pick another status to see the rest."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((applicant) => (
            <li key={applicant.id}>
              <ApplicantCard
                applicant={applicant}
                open={openId === applicant.id}
                loading={loadingId === applicant.id}
                savingDecision={savingId === applicant.id ? savingDecision : null}
                error={errors[applicant.id] ?? null}
                onToggle={() => onToggle(applicant)}
                onDecide={(status) => onDecide(applicant, status)}
              />
            </li>
          ))}
        </ul>
      )}

      {canLoadMore ? (
        <div className="flex flex-col items-center gap-2.5 pt-1">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full border-[1.5px] border-border px-4 text-foreground sm:w-auto"
            onClick={onLoadMore}
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
            {loadingMore ? "Loading more…" : "Load more applicants"}
          </Button>
          {loadMoreError ? (
            <p
              role="alert"
              className="flex flex-wrap items-center gap-2 text-[14px] font-medium text-danger"
            >
              Could not load more applicants.
              <button
                type="button"
                onClick={onLoadMore}
                className="underline underline-offset-2"
              >
                Try again
              </button>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}