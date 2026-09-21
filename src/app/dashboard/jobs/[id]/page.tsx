"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  Calendar,
  ChevronLeft,
  CircleDot,
  Clock,
  MapPin,
  Target,
  Users,
} from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import { getJob, type JobWithFit } from "@/lib/api/jobPostings";
import { JobsListSkeleton, JobsEmptyState } from "@/components/jobs/job-states";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import {
  AppliedPill,
  BandPill,
  FitPill,
  formatOpenings,
  formatPayRange,
  formatPostedDate,
  KindPill,
} from "@/components/jobs/job-pills";
import { deadlineText } from "@/components/jobs/deadline-text";
import { ApplyPanel } from "@/components/jobs/apply-panel";

import { cn } from "cn";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; job: JobWithFit }
  | { kind: "notFound" }
  | { kind: "error" };

/** `/dashboard/jobs/{id}`: one opening with a per-skill "How you fit",
 *  embedded `ApplyPanel`, and the unavailable banner for paused or
 *  expired postings the student has already applied to. `ApplyPanel`
 *  is rendered exactly once, inside the right-rail `<aside>` (always
 *  in flow — at lg it lives in the right column, below lg it sits
 *  under the main column). On phone the `PhoneApplyBar` sticky bar
 *  carries a fit pill, the deadline chip, and an "Apply" /
 *  "View application" button that scrolls smoothly to the apply
 *  section and moves keyboard focus into it — so the primary
 *  action is reachable without scrolling past the main content. */
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
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-5">
        <Link
          href="/dashboard/jobs"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ChevronLeft className="size-4" aria-hidden />
          Back to openings
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

function isUnavailable(job: JobWithFit): boolean {
  return job.isExpired === true || job.status === "Paused" || job.status === "Closed";
}

function fitSummaryText(job: JobWithFit): {
  sentence: string;
  body: string;
} {
  const matchedNames = job.fit.matched.map((m) => m.name);
  const missingNames = job.fit.missing;
  const matchedCount = matchedNames.length;
  const missingCount = missingNames.length;
  const total = matchedCount + missingCount;
  const sentence =
    total === 0
      ? "This role has no required skills listed."
      : matchedCount === 0
        ? `You have none of the ${total} skill${total === 1 ? "" : "s"} this role asks for yet.`
        : matchedCount === total
          ? `You show all ${total} of the skill${total === 1 ? "" : "s"} this role asks for.`
          : `You show ${matchedCount} of the ${total} skills this role asks for.`;

  let body: string;
  if (matchedCount > 0 && missingCount > 0) {
    const haveList = joinNames(matchedNames);
    const needList = joinNames(missingNames);
    body = `${haveList} ${matchedNames.length === 1 ? "is" : "are"} in your portfolio. ${needList} ${missingNames.length === 1 ? "is" : "are"} not shown yet.`;
  } else if (matchedCount > 0) {
    body = `${joinNames(matchedNames)} ${matchedNames.length === 1 ? "is" : "are"} in your portfolio.`;
  } else if (missingCount > 0) {
    body = `${joinNames(missingNames)} ${missingNames.length === 1 ? "is" : "are"} not shown yet.`;
  } else {
    body = "Update your portfolio to show more of what you can do.";
  }
  return { sentence, body };
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function JobDetail({ job }: { job: JobWithFit }) {
  const unavailable = isUnavailable(job);
  const applied = job.application !== null;
  const bandBySkill = new Map(
    job.fit.matched.map((m) => [m.name.toLowerCase(), m.band]),
  );
  const summary = fitSummaryText(job);
  const pay = job.compensation
    ? formatPayRange(job.compensation.min, job.compensation.max, "per month")
    : null;
  const posted = formatPostedDate(job.createdAt);
  const deadline = deadlineText(job.applicationDeadline ?? null);
  const workModeLabel =
    job.workMode === "OnSite" ? "On-site" : job.workMode;
  const location = job.location?.trim();
  const whereText = location ? `${location}, ${workModeLabel}` : workModeLabel;

  const keyFacts: KeyFactItem[] = [
    {
      icon: <CircleDot className="size-[18px]" aria-hidden />,
      label: "Type",
      value: job.kind,
    },
    {
      icon: <MapPin className="size-[18px]" aria-hidden />,
      label: "Where",
      value: whereText,
    },
    {
      icon: <Calendar className="size-[18px]" aria-hidden />,
      label: "Apply by",
      value: deadlineTextValue(deadline),
    },
    {
      icon: <Users className="size-[18px]" aria-hidden />,
      label: "Openings",
      value: formatOpenings(job.openings),
    },
    ...(pay
      ? [
          {
            icon: <Banknote className="size-[18px]" aria-hidden />,
            label: "Pay",
            value: pay,
          },
        ]
      : []),
    ...(posted
      ? [
          {
            icon: <Clock className="size-[18px]" aria-hidden />,
            label: "Posted",
            value: posted,
          },
        ]
      : []),
  ];

  return (
    <>
      {unavailable && applied ? (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-[14px] border bg-warning-soft px-4 py-3 text-[15px] font-bold text-warning"
          style={{ borderColor: "var(--border)" }}
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          <span>This opening is no longer accepting applications.</span>
        </div>
      ) : null}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-7">
        <main className="flex min-w-0 flex-1 flex-col gap-4 lg:max-w-[790px]">
          <OpeningHeader job={job} />
          <FitSummary sentence={summary.sentence} body={summary.body} />
          <AboutSection description={job.description} />
          <HowYouFitSection
            requiredSkills={job.requiredSkills}
            bandBySkill={bandBySkill}
          />
        </main>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:w-[342px]">
          {/* Apply card. Always visible — at lg it sits inside the right
              rail; on mobile it appears below the main column (the outer
              flex is column below lg). The phone sticky bar at the bottom
              only carries a meta strip (fit pill + deadline) plus an
              "Apply" / "View application" button that scrolls to and
              focuses this section — it does NOT render another
              ApplyPanel, so the apply action is rendered exactly once. */}
          <section
            id="apply-section"
            aria-label="Apply"
            tabIndex={-1}
            className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-md focus:outline-none"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="font-heading text-[18px] font-semibold text-foreground">
              {applied ? "Your application" : "Apply to this opening"}
            </h2>
            <p className="text-[14px] leading-[1.5] text-muted-foreground">
              {applied
                ? "You can follow this and other applications on your applications page."
                : "Your portfolio and profile choices are sent with your application. You can review them first."}
            </p>
            {unavailable && !applied ? (
              <p className="rounded-[10px] bg-secondary px-3.5 py-2.5 text-[14px] font-semibold text-muted-foreground">
                Applications are closed for this opening.
              </p>
            ) : (
              <ApplyPanel jobId={job.id} initial={job.application} />
            )}
          </section>
          <KeyFacts facts={keyFacts} />
        </aside>
      </div>

      {/* Phone sticky bottom bar — visible below lg only. */}
      <PhoneApplyBar job={job} unavailable={unavailable} applied={applied} />
    </>
  );
}

function deadlineTextValue(d: ReturnType<typeof deadlineText>): string {
  if (d.kind === "none") return "Open until filled";
  return d.text;
}

function OpeningHeader({ job }: { job: JobWithFit }) {
  const posted = formatPostedDate(job.createdAt);
  const location = job.location?.trim();
  const workModeLabel =
    job.workMode === "OnSite" ? "On-site" : job.workMode;
  const whereText = location ? `${location}, ${workModeLabel}` : workModeLabel;
  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-sm sm:p-7"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <FitPill label={job.fit.label} />
        <KindPill kind={job.kind} />
        <span className="inline-flex items-center whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-[12px] font-bold text-muted-foreground">
          {workModeLabel}
        </span>
        {job.application ? <AppliedPill /> : null}
      </div>
      <h1 className="font-heading text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[34px]">
        {job.title}
      </h1>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-[14px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <Building2 className="size-4" aria-hidden />
          {job.companyName}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
          <MapPin className="size-4" aria-hidden />
          {whereText}
        </span>
        {posted ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-muted-foreground">
            <Clock className="size-4" aria-hidden />
            Posted {posted}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function FitSummary({ sentence, body }: { sentence: string; body: string }) {
  return (
    <section
      aria-label="Fit summary"
      className="flex items-start gap-3.5 rounded-2xl border bg-accent p-4 sm:p-5"
      style={{ borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card"
      >
        <Target className="size-[22px] text-primary" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="font-heading text-[18px] font-semibold leading-tight text-foreground">
          {sentence}
        </p>
        <p className="mt-1 text-[14px] leading-[1.5] text-info">{body}</p>
      </div>
    </section>
  );
}

function AboutSection({ description }: { description: string }) {
  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border bg-card p-6 shadow-sm sm:p-7"
      style={{ borderColor: "var(--border)" }}
    >
      <h2 className="font-heading text-[19px] font-semibold text-foreground">
        About this opening
      </h2>
      <p className="whitespace-pre-line text-[15px] leading-[1.65] text-foreground">
        {description}
      </p>
    </section>
  );
}

function HowYouFitSection({
  requiredSkills,
  bandBySkill,
}: {
  requiredSkills: string[];
  bandBySkill: Map<string, "Strong" | "Developing">;
}) {
  const have = requiredSkills.filter((s) => bandBySkill.has(s.toLowerCase()));
  const toBuild = requiredSkills.filter((s) => !bandBySkill.has(s.toLowerCase()));

  return (
    <section
      aria-labelledby="how-you-fit"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:p-7"
      style={{ borderColor: "var(--border)" }}
    >
      <div>
        <h2
          id="how-you-fit"
          className="font-heading text-[19px] font-semibold text-foreground"
        >
          How you fit
        </h2>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Based on the skills your portfolio already shows.
        </p>
      </div>
      {have.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[14px] font-bold text-success">
            <Target className="size-4" aria-hidden />
            Skills you have
          </div>
          <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
            {have.map((skill) => {
              const band = bandBySkill.get(skill.toLowerCase());
              return (
                <li
                  key={skill}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <span className="text-[15px] font-bold text-foreground">{skill}</span>
                  {band ? <BandPill band={band} /> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {toBuild.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[14px] font-bold text-muted-foreground">
            <CircleDot className="size-4" aria-hidden />
            Skills to build
          </div>
          <ul className="flex flex-col divide-y" style={{ borderColor: "var(--border)" }}>
            {toBuild.map((skill) => (
              <li
                key={skill}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="text-[15px] font-bold text-foreground">{skill}</span>
                <span className="text-[13px] font-semibold text-muted-foreground">
                  Not shown yet
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Link
        href="/dashboard/portfolio"
        className="inline-flex w-fit items-center gap-1.5 text-[14px] font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        Add work to your portfolio
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

interface KeyFactItem {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function KeyFacts({ facts }: { facts: KeyFactItem[] }) {
  return (
    <section
      aria-label="Key facts"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
      style={{ borderColor: "var(--border)" }}
    >
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-start gap-2.5">
          <span className="mt-0.5 text-muted-foreground">{fact.icon}</span>
          <div>
            <div className="text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
              {fact.label}
            </div>
            <div className="text-[15px] font-semibold text-foreground">{fact.value}</div>
          </div>
        </div>
      ))}
    </section>
  );
}

/**
 * Selector for the first focusable child inside a section, mirroring the
 * pattern used by the `Dialog` primitive (`src/components/ui/dialog.tsx`).
 * Used to move keyboard / screen-reader focus into the apply section when
 * the user activates the sticky bar's button.
 */
const APPLY_SECTION_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function PhoneApplyBar({
  job,
  unavailable,
  applied,
}: {
  job: JobWithFit;
  unavailable: boolean;
  applied: boolean;
}) {
  if (unavailable && !applied) {
    return null;
  }
  const deadline = deadlineText(job.applicationDeadline ?? null);
  const closingSoon = deadline.kind === "today" || deadline.kind === "soon";
  const deadlineTextValue =
    deadline.kind === "none" ? null : deadline.text;

  function focusApplySection() {
    const section = document.getElementById("apply-section");
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    const focusables = section.querySelectorAll<HTMLElement>(
      APPLY_SECTION_FOCUSABLE_SELECTOR,
    );
    const target = focusables[0] ?? section;
    // Defer focus until after the smooth scroll starts so the focus
    // ring does not pop on top of the button the user just pressed.
    window.requestAnimationFrame(() => target.focus({ preventScroll: true }));
  }

  return (
    <div
      role="region"
      aria-label="Phone sticky apply bar"
      className={cn(
        "sticky bottom-3 z-10 mt-2 flex items-center gap-3 rounded-2xl border bg-card/95 p-3 shadow-md backdrop-blur lg:hidden",
      )}
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <FitPill label={job.fit.label} />
        {deadlineTextValue ? (
          <span
            className={cn(
              "text-[12px] font-bold",
              closingSoon ? "text-warning" : "text-muted-foreground",
            )}
          >
            {deadlineTextValue}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={focusApplySection}
        className="inline-flex h-12 w-full max-w-[200px] items-center justify-center rounded-[10px] bg-primary px-4 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {applied ? "View application" : "Apply"}
      </button>
    </div>
  );
}
