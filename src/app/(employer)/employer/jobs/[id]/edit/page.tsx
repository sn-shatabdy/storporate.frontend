"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Banknote, Building2, Calendar, ChevronLeft, Lock, MapPin, Users } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  getMyPosting,
  updatePosting,
  type JobPosting,
  type JobPostingRequest,
} from "@/lib/api/jobPostings";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import { JobsEmptyState, JobsListSkeleton } from "@/components/jobs/job-states";
import {
  formatOpenings,
  formatPayRange,
  KindPill,
  SkillChip,
  StatusPill,
  workModeAndLocation,
} from "@/components/jobs/job-pills";
import { PostingForm } from "@/components/jobs/posting-form";
import { valuesFromPosting } from "@/components/jobs/posting-helpers";
import { deadlineText } from "@/components/jobs/deadline-text";

import { cn } from "cn";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; posting: JobPosting }
  | { kind: "notFound" }
  | { kind: "error" };

/** `/employer/jobs/{id}/edit`: change an opening. Closed openings are read only. */
export default function EditPostingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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
        const posting = await getMyPosting(accessToken, id, controller.signal);
        if (controller.signal.aborted) return;
        setState({ kind: "loaded", posting });
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
  }, [accessToken, id, version]);

  async function handleSubmit(request: JobPostingRequest) {
    if (!accessToken || !id) throw new Error("Not signed in");
    await updatePosting(accessToken, id, request);
    router.push("/employer/jobs?saved=updated");
  }

  function refetch() {
    setVersion((v) => v + 1);
  }

  const closed = state.kind === "loaded" && state.posting.status === "Closed";

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
        <div>
          <Link
            href="/employer/jobs"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Your openings
          </Link>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {closed ? "Closed opening" : "Edit opening"}
          </h1>
        </div>

        {state.kind === "loading" ? (
          <JobsListSkeleton label="Loading the opening." />
        ) : state.kind === "notFound" ? (
          <JobsEmptyState
            title="Opening not found"
            message="It may have been removed. Go back to your openings."
          />
        ) : state.kind === "error" ? (
          <AdvisorErrorState
            title="Could not load this opening"
            message="Check your connection and try again."
            onRetry={refetch}
          />
        ) : closed ? (
          <ClosedSummary posting={state.posting} />
        ) : (
          <PostingForm
            initialValues={valuesFromPosting(state.posting)}
            submitLabel="Save changes"
            cancelHref="/employer/jobs"
            onSubmit={handleSubmit}
            onConflict={refetch}
          />
        )}
      </div>
    </div>
  );
}

function ClosedSummary({ posting }: { posting: JobPosting }) {
  const deadline = deadlineText(posting.applicationDeadline ?? null);
  const pay = formatPayRange(
    posting.compensation?.min ?? null,
    posting.compensation?.max ?? null,
    "per month",
  );
  const deadlineLabel =
    deadline.kind === "none"
      ? null
      : deadline.kind === "past"
        ? deadline.text
        : deadline.kind === "today"
          ? "Closes today"
          : deadline.kind === "soon"
            ? deadline.text
            : `Closes ${deadline.text.replace(/^Closes /, "")}`;
  return (
    <div className="flex flex-col gap-4">
      <div
        role="status"
        className="flex items-start gap-3 rounded-[14px] border bg-secondary p-4 text-sm text-foreground"
        style={{ borderColor: "var(--border)" }}
      >
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p>
          This opening is closed. Closed openings are final, so they cannot be
          edited or reopened. Post a new opening if you need one like it.
        </p>
      </div>
      <article
        className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-7"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <KindPill kind={posting.kind} />
            <StatusPill status={posting.status} icon={Lock} />
          </div>
          <h2 className="font-heading text-[26px] font-semibold leading-tight text-foreground">
            {posting.title}
          </h2>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Meta icon={<Building2 className="size-4" aria-hidden />}>
            {posting.companyName}
          </Meta>
          <Meta icon={<MapPin className="size-4" aria-hidden />}>
            {workModeAndLocation(posting.workMode, posting.location)}
          </Meta>
          {deadlineLabel ? (
            <Meta icon={<Calendar className="size-4" aria-hidden />}>
              {deadlineLabel}
            </Meta>
          ) : null}
          <Meta icon={<Users className="size-4" aria-hidden />}>
            {formatOpenings(posting.openings)}
          </Meta>
          {pay ? (
            <Meta icon={<Banknote className="size-4" aria-hidden />}>{pay}</Meta>
          ) : null}
        </div>
        <p className="whitespace-pre-line text-[15px] leading-[1.6] text-foreground">
          {posting.description}
        </p>
        {posting.requiredSkills.length > 0 ? (
          <ul
            className="flex flex-wrap gap-2"
            aria-label="Required skills"
          >
            {posting.requiredSkills.map((skill) => (
              <li key={skill}>
                <SkillChip>{skill}</SkillChip>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 border-t pt-5" style={{ borderColor: "var(--border)" }}>
          <Button asChild variant="outline" size="lg" className="h-11 px-4">
            <Link href={`/employer/jobs/${encodeURIComponent(posting.id)}/applicants`}>
              <Users className="size-[18px]" aria-hidden />
              View applicants ({posting.applicantCount ?? 0})
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-11 px-4">
            <Link href="/employer/jobs">Back to openings</Link>
          </Button>
        </div>
      </article>
    </div>
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
        "inline-flex items-center gap-1.5 text-[14px] font-medium text-muted-foreground",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}