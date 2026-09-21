"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, Pause, Pencil, Play, Plus, Users, X } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  listMyPostings,
  setPostingStatus,
  type JobPosting,
  type PostingStatus,
} from "@/lib/api/jobPostings";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import {
  formatPostedDate,
  KindPill,
  SkillChip,
  StatusPill,
  workModeAndLocation,
} from "@/components/jobs/job-pills";
import { JobsEmptyState, JobsListSkeleton } from "@/components/jobs/job-states";

const FLASH_MESSAGES: Record<string, string> = {
  created: "Opening posted.",
  updated: "Changes saved.",
};

/** `/employer/jobs`: the employer's own openings. The (employer) layout owns
 *  the authorization gate. */
export default function EmployerJobsPage() {
  return (
    <Suspense fallback={null}>
      <EmployerJobsInner />
    </Suspense>
  );
}

function EmployerJobsInner() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<JobPosting[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(
    () => FLASH_MESSAGES[searchParams?.get("saved") ?? ""] ?? null,
  );

  // Drop the saved marker from the URL so a refresh does not repeat the line.
  useEffect(() => {
    if (flash && searchParams?.get("saved")) {
      router.replace(pathname ?? "/employer/jobs");
    }
  }, [flash, searchParams, router, pathname]);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      setFailed(false);
      try {
        const result = await listMyPostings(accessToken, controller.signal);
        if (controller.signal.aborted) return;
        setItems(result.items);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
      }
    })();
    return () => controller.abort();
  }, [accessToken, version]);

  const changeStatus = useCallback(
    async (posting: JobPosting, status: PostingStatus) => {
      if (!accessToken || busyId) return;
      setBusyId(posting.id);
      setActionError(null);
      setFlash(null);
      try {
        const updated = await setPostingStatus(accessToken, posting.id, status);
        setItems((prev) =>
          prev ? prev.map((p) => (p.id === updated.id ? updated : p)) : prev,
        );
        setConfirmId(null);
      } catch (error) {
        if (error instanceof ApiError && error.errorCode === "job_posting_closed") {
          setActionError("That opening is already closed.");
          setVersion((v) => v + 1);
        } else {
          setActionError("Could not update the opening. Try again.");
        }
      } finally {
        setBusyId(null);
      }
    },
    [accessToken, busyId],
  );

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Your openings
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Jobs and internships students can see and match against.
            </p>
          </div>
          <Button asChild size="lg" className="h-10 w-full px-4 sm:h-9 sm:w-auto">
            <Link href="/employer/jobs/new">
              <Plus className="size-4" aria-hidden />
              Post an opening
            </Link>
          </Button>
        </div>

        {flash ? (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-[14px] border bg-[#e6f4ea] px-4 py-3 text-sm font-medium text-[#1e7b34]"
            style={{ borderColor: "rgba(30,123,52,0.25)" }}
          >
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{flash}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setFlash(null)}
              className="inline-flex size-6 items-center justify-center rounded-full hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : null}

        {actionError ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {actionError}
          </p>
        ) : null}

        {failed && items === null ? (
          <AdvisorErrorState
            title="Could not load your openings"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : items === null ? (
          <JobsListSkeleton label="Loading your openings." />
        ) : items.length === 0 ? (
          <JobsEmptyState
            title="No openings yet"
            message="Post a job or internship and students can start matching against it."
            action={
              <Button asChild size="lg" className="mt-1 h-10 px-4 sm:h-9">
                <Link href="/employer/jobs/new">
                  <Plus className="size-4" aria-hidden />
                  Post an opening
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((posting) => (
              <li key={posting.id}>
                <PostingCard
                  posting={posting}
                  busy={busyId === posting.id}
                  anyBusy={busyId !== null}
                  confirming={confirmId === posting.id}
                  onAskClose={() => {
                    setActionError(null);
                    setConfirmId(posting.id);
                  }}
                  onCancelClose={() => setConfirmId(null)}
                  onStatus={(status) => changeStatus(posting, status)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PostingCard({
  posting,
  busy,
  anyBusy,
  confirming,
  onAskClose,
  onCancelClose,
  onStatus,
}: {
  posting: JobPosting;
  busy: boolean;
  anyBusy: boolean;
  confirming: boolean;
  onAskClose: () => void;
  onCancelClose: () => void;
  onStatus: (status: PostingStatus) => void;
}) {
  const closed = posting.status === "Closed";
  const editHref = `/employer/jobs/${encodeURIComponent(posting.id)}/edit`;
  const applicantsHref = `/employer/jobs/${encodeURIComponent(posting.id)}/applicants`;
  const posted = formatPostedDate(posting.createdAt);

  return (
    <article
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
      style={{ borderColor: "var(--border)" }}
      aria-busy={busy}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold leading-snug text-foreground">
            {posting.title}
          </h2>
          <StatusPill status={posting.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <KindPill kind={posting.kind} />
          <span className="text-sm text-muted-foreground">
            {workModeAndLocation(posting.workMode, posting.location)}
          </span>
          {posted ? (
            <span className="text-xs text-muted-foreground">
              Posted {posted}
            </span>
          ) : null}
        </div>
      </div>

      {posting.requiredSkills.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Required skills">
          {posting.requiredSkills.map((skill) => (
            <li key={skill}>
              <SkillChip>{skill}</SkillChip>
            </li>
          ))}
        </ul>
      ) : null}

      {confirming ? (
        <div
          role="alertdialog"
          aria-label={`Close ${posting.title}`}
          className="flex flex-col gap-3 rounded-xl border bg-[#fbe9e7] p-4"
          style={{ borderColor: "rgba(179,38,30,0.25)" }}
        >
          <p className="text-sm text-foreground">
            Close this opening? Students will no longer see it. A closed opening
            cannot be edited or reopened.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="lg"
              disabled={busy}
              onClick={() => onStatus("Closed")}
              className="h-9 bg-[#b3261e] text-white hover:bg-[#b3261e]/90"
            >
              {busy ? "Closing…" : "Yes, close it"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={busy}
              onClick={onCancelClose}
              className="h-9 bg-white"
            >
              Keep it
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="flex flex-wrap gap-2 border-t pt-4"
          style={{ borderColor: "var(--border)" }}
        >
          <Button asChild variant="outline" size="lg" className="h-9">
            <Link href={applicantsHref}>
              <Users className="size-4" aria-hidden />
              Applicants
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-9">
            <Link href={editHref}>
              <Pencil className="size-4" aria-hidden />
              {closed ? "View" : "Edit"}
            </Link>
          </Button>
          {posting.status === "Open" ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={anyBusy}
              onClick={() => onStatus("Paused")}
              className="h-9"
            >
              <Pause className="size-4" aria-hidden />
              Pause
            </Button>
          ) : null}
          {posting.status === "Paused" ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={anyBusy}
              onClick={() => onStatus("Open")}
              className="h-9"
            >
              <Play className="size-4" aria-hidden />
              Reopen
            </Button>
          ) : null}
          {!closed ? (
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={anyBusy}
              onClick={onAskClose}
              className="h-9 text-[#b3261e] hover:bg-[#fbe9e7] hover:text-[#b3261e]"
            >
              Close
            </Button>
          ) : null}
        </div>
      )}
    </article>
  );
}
