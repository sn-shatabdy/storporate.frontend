"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

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

/** `/dashboard/applications`: every application the student has sent. */
export default function MyApplicationsPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [items, setItems] = useState<ApplicationResponse[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      setFailed(false);
      try {
        const result = await listMyApplications(accessToken, controller.signal);
        if (controller.signal.aborted) return;
        setItems(result.items);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
      }
    })();
    return () => controller.abort();
  }, [accessToken, version]);

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

        {failed && items === null ? (
          <AdvisorErrorState
            title="Could not load your applications"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : items === null ? (
          <JobsListSkeleton label="Loading your applications." />
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
          <div className="flex flex-col gap-3">
            <p
              className="text-xs font-medium text-muted-foreground"
              aria-live="polite"
            >
              {items.length === 1 ? "1 application" : `${items.length} applications`}
            </p>
            <ul className="flex flex-col gap-3">
              {items.map((application) => (
                <li key={application.id}>
                  <ApplicationCard application={application} />
                </li>
              ))}
            </ul>
          </div>
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
      className="relative flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring/40 hover:bg-[#fffdf6]"
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
