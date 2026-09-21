"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import { getJob, type JobWithFit } from "@/lib/api/jobPostings";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import {
  BandPill,
  FitPill,
  KindPill,
  workModeAndLocation,
} from "@/components/jobs/job-pills";
import { JobsEmptyState, JobsListSkeleton } from "@/components/jobs/job-states";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; job: JobWithFit }
  | { kind: "notFound" }
  | { kind: "error" };

/** `/dashboard/jobs/{id}`: one opening with a per-skill "How you fit". */
export default function OpeningDetailPage() {
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
        const job = await getJob(accessToken, id, controller.signal);
        if (controller.signal.aborted) return;
        setState({ kind: "loaded", job });
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

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <Link
          href="/dashboard/jobs"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Openings
        </Link>

        {state.kind === "loading" ? (
          <JobsListSkeleton label="Loading the opening." />
        ) : state.kind === "notFound" ? (
          <JobsEmptyState
            title="This opening is no longer available"
            message="The employer may have paused or closed it. Go back to see what is open."
          />
        ) : state.kind === "error" ? (
          <AdvisorErrorState
            title="Could not load this opening"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : (
          <JobDetail job={state.job} />
        )}
      </div>
    </div>
  );
}

function JobDetail({ job }: { job: JobWithFit }) {
  const bandBySkill = new Map(
    job.fit.matched.map((m) => [m.name.toLowerCase(), m.band]),
  );

  return (
    <>
      <header
        className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <KindPill kind={job.kind} />
          <FitPill label={job.fit.label} />
        </div>
        <h1 className="font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
          {job.title}
        </h1>
        <p className="text-sm text-foreground sm:text-base">
          {job.companyName}
          <span className="text-muted-foreground">
            {" · "}
            {workModeAndLocation(job.workMode, job.location)}
          </span>
        </p>
      </header>

      <section
        className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 className="font-heading text-lg font-semibold text-foreground">
          About this opening
        </h2>
        <p className="whitespace-pre-line text-sm leading-6 text-foreground">
          {job.description}
        </p>
      </section>

      <section
        aria-labelledby="how-you-fit"
        className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
        style={{ borderColor: "var(--border)" }}
      >
        <h2
          id="how-you-fit"
          className="font-heading text-lg font-semibold text-foreground"
        >
          How you fit
        </h2>
        <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
          {job.requiredSkills.map((skill) => {
            const band = bandBySkill.get(skill.toLowerCase());
            return (
              <li
                key={skill}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="text-sm font-medium text-foreground">{skill}</span>
                {band ? (
                  <BandPill band={band} />
                ) : (
                  <span className="text-xs font-medium text-muted-foreground">
                    Not shown yet
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted-foreground">
          Add work to your{" "}
          <Link
            href="/dashboard/portfolio"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            portfolio
          </Link>{" "}
          to show more skills.
        </p>
      </section>
    </>
  );
}
