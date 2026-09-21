"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";

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

type StatusFilter = "All" | ApplicationStatus;

const FILTERS: StatusFilter[] = [
  "All",
  "Submitted",
  "Viewed",
  "Shortlisted",
  "NotSelected",
];

function filterLabel(filter: StatusFilter): string {
  return filter === "All" ? "All" : APPLICATION_STATUS_LABELS[filter];
}

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; posting: JobPosting; applicants: ApplicantResponse[] }
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
  const [filter, setFilter] = useState<StatusFilter>("All");

  const [openId, setOpenId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingDecision, setSavingDecision] = useState<ApplicantDecision | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Applicants whose detail request already ran (that request marks Viewed).
  const loadedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!accessToken || !postingId) return;
    const controller = new AbortController();
    (async () => {
      setState({ kind: "loading" });
      try {
        const [posting, list] = await Promise.all([
          getMyPosting(accessToken, postingId, controller.signal),
          listApplicants(accessToken, postingId, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        loadedIds.current = new Set();
        setOpenId(null);
        setErrors({});
        setState({ kind: "loaded", posting, applicants: list.items });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.errorCode === "job_posting_not_found") {
          setState({ kind: "notFound" });
        } else {
          setState({ kind: "error" });
        }
      }
    })();
    return () => controller.abort();
  }, [accessToken, postingId, version]);

  const replaceApplicant = useCallback((updated: ApplicantResponse) => {
    setState((prev) =>
      prev.kind === "loaded"
        ? {
            ...prev,
            applicants: prev.applicants.map((a) =>
              a.id === updated.id ? updated : a,
            ),
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
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
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

            {state.applicants.length === 0 ? (
              <JobsEmptyState
                title="No applications yet."
                message="When students apply, they show up here with how they fit."
              />
            ) : (
              <>
                <div
                  role="group"
                  aria-label="Filter by status"
                  className="flex flex-wrap gap-2"
                >
                  {FILTERS.map((f) => {
                    const active = filter === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setFilter(f)}
                        className={
                          active
                            ? "inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                            : "inline-flex h-8 items-center rounded-full border bg-background px-3.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        }
                      >
                        {filterLabel(f)}
                      </button>
                    );
                  })}
                </div>

                <ApplicantList
                  applicants={state.applicants}
                  filter={filter}
                  openId={openId}
                  loadingId={loadingId}
                  savingId={savingId}
                  savingDecision={savingDecision}
                  errors={errors}
                  onToggle={toggle}
                  onDecide={decide}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ApplicantList({
  applicants,
  filter,
  openId,
  loadingId,
  savingId,
  savingDecision,
  errors,
  onToggle,
  onDecide,
}: {
  applicants: ApplicantResponse[];
  filter: StatusFilter;
  openId: string | null;
  loadingId: string | null;
  savingId: string | null;
  savingDecision: ApplicantDecision | null;
  errors: Record<string, string>;
  onToggle: (a: ApplicantResponse) => void;
  onDecide: (a: ApplicantResponse, status: ApplicantDecision) => void;
}) {
  // The open card stays visible even when its status changes, so it does not
  // vanish from under the employer mid-decision.
  const visible = applicants.filter(
    (a) => filter === "All" || a.status === filter || a.id === openId,
  );

  if (visible.length === 0) {
    return (
      <JobsEmptyState
        title="No applications here"
        message="Pick another status to see the rest."
      />
    );
  }

  return (
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
  );
}
