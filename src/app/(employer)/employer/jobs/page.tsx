"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Lock,
  MapPin,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  listMyPostings,
  setPostingStatus,
  type JobPosting,
  type PostingCounts,
  type PostingStatus,
} from "@/lib/api/jobPostings";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Menu, type MenuItem } from "@/components/ui/menu";
import {
  formatOpenings,
  formatPayRange,
  formatPostedDate,
  KindPill,
  SkillChip,
  StatusPill,
  workModeAndLocation,
} from "@/components/jobs/job-pills";
import {
  EmployerNoMatch,
  EmployerNoOpenings,
  JobsErrorState,
  JobsListSkeleton,
} from "@/components/jobs/job-states";

import { deadlineText } from "@/components/jobs/deadline-text";

import { cn } from "cn";

const FLASH_MESSAGES: Record<string, string> = {
  created: "Opening posted.",
  updated: "Changes saved.",
};

type StatusFilter = "All" | PostingStatus;

const TABS: { value: StatusFilter; label: string }[] = [
  { value: "All", label: "All" },
  { value: "Open", label: "Open" },
  { value: "Paused", label: "Paused" },
  { value: "Closed", label: "Closed" },
];

const SEARCH_DEBOUNCE_MS = 350;

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
  const [counts, setCounts] = useState<PostingCounts | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
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

  // Debounce search input so we don't refetch per keystroke.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      setFailed(false);
      try {
        const result = await listMyPostings(
          accessToken,
          {
            ...(statusFilter === "All" ? {} : { status: statusFilter }),
            ...(debouncedQuery ? { q: debouncedQuery } : {}),
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setItems(result.items);
        setCounts(result.counts);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
      }
    })();
    return () => controller.abort();
  }, [accessToken, version, statusFilter, debouncedQuery]);

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
        setConfirmCloseId(null);
        // Refetch so the tab counts (always unfiltered on the wire) refresh.
        setVersion((v) => v + 1);
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

  const closeCandidate = useMemo(
    () => items?.find((p) => p.id === confirmCloseId) ?? null,
    [items, confirmCloseId],
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
              Post jobs and internships, and review the students who apply.
            </p>
          </div>
          <Button asChild size="lg" className="h-11 w-full px-4 sm:h-11 sm:w-auto">
            <Link href="/employer/jobs/new">
              <Plus className="size-4" aria-hidden />
              Post an opening
            </Link>
          </Button>
        </div>

        {flash ? (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-[14px] border bg-success-soft px-4 py-3 text-sm font-medium text-success"
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
          <p role="alert" className="text-sm font-medium text-danger">
            {actionError}
          </p>
        ) : null}

        {/* Tabs + search */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Filter by status"
            className="-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible"
          >
            {TABS.map((tab) => {
              const isSelected = statusFilter === tab.value;
              const tabCount = counts ? countsForTab(counts, tab.value) : null;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-bold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    isSelected
                      ? "border border-primary bg-primary text-primary-foreground"
                      : "border border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {tab.label}
                  {tabCount !== null ? (
                    <span
                      className={cn(
                        "min-w-[24px] rounded-full px-1.5 py-0.5 text-center text-[12px] font-bold",
                        isSelected
                          ? "bg-white/25 text-primary-foreground"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {tabCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <label className="relative block w-full sm:w-[260px]">
            <span className="sr-only">Search your openings</span>
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              placeholder="Search your openings"
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search your openings"
              className="h-[46px] w-full rounded-[10px] border border-border bg-background pl-10 pr-3.5 text-[15px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </label>
        </div>

        {/* Live status line */}
        {items !== null && items.length > 0 ? (
          <p
            role="status"
            aria-live="polite"
            className="text-sm font-medium text-muted-foreground"
          >
            Showing {items.length} of {counts?.total ?? items.length}{" "}
            {(counts?.total ?? items.length) === 1 ? "opening" : "openings"}
          </p>
        ) : null}

        {failed && items === null ? (
          <JobsErrorState
            title="Could not load your openings"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : items === null ? (
          <JobsListSkeleton label="Loading your openings." />
        ) : items.length === 0 && statusFilter === "All" && !debouncedQuery ? (
          <EmployerNoOpenings
            action={
              <Button asChild size="lg" className="mt-1 h-11 px-4">
                <Link href="/employer/jobs/new">
                  <Plus className="size-4" aria-hidden />
                  Post an opening
                </Link>
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmployerNoMatch
            message={
              debouncedQuery
                ? `No openings match “${debouncedQuery}”. Try a different word, or clear filters.`
                : statusFilter === "Open"
                  ? "No openings are open right now."
                  : statusFilter === "Paused"
                    ? "No openings are paused."
                    : "No closed openings yet."
            }
            onClearFilters={() => {
              setQuery("");
              setStatusFilter("All");
            }}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((posting) => (
              <li key={posting.id}>
                <PostingCard
                  posting={posting}
                  busy={busyId === posting.id}
                  anyBusy={busyId !== null}
                  onAskClose={() => {
                    setActionError(null);
                    setConfirmCloseId(posting.id);
                  }}
                  onStatus={(status) => changeStatus(posting, status)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={confirmCloseId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmCloseId(null);
        }}
        title="Close this opening?"
        description={
          closeCandidate ? (
            <>
              Students will no longer see &quot;{closeCandidate.title}&quot;.
              Closing cannot be undone. Your applicants stay in your list.
            </>
          ) : (
            "Closing cannot be undone."
          )
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 px-4"
              onClick={() => setConfirmCloseId(null)}
            >
              Keep it
            </Button>
            <Button
              type="button"
              size="lg"
              className="h-11 bg-danger px-4 text-white hover:bg-danger/90"
              onClick={() => {
                if (closeCandidate) {
                  void changeStatus(closeCandidate, "Closed");
                }
              }}
            >
              Yes, close it
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger"
          >
            <AlertTriangle className="size-6" strokeWidth={1.8} aria-hidden />
          </span>
          <p className="text-[15px] leading-[1.55] text-muted-foreground">
            Use this if the role is filled or no longer relevant. New students
            will not be able to apply.
          </p>
        </div>
      </Dialog>
    </div>
  );
}

function countsForTab(counts: PostingCounts, tab: StatusFilter): number {
  switch (tab) {
    case "All":
      return counts.total;
    case "Open":
      return counts.open;
    case "Paused":
      return counts.paused;
    case "Closed":
      return counts.closed;
  }
}

function PostingCard({
  posting,
  busy,
  anyBusy,
  onAskClose,
  onStatus,
}: {
  posting: JobPosting;
  busy: boolean;
  anyBusy: boolean;
  onAskClose: () => void;
  onStatus: (status: PostingStatus) => void;
}) {
  const closed = posting.status === "Closed";
  const editHref = `/employer/jobs/${encodeURIComponent(posting.id)}/edit`;
  const applicantsHref = `/employer/jobs/${encodeURIComponent(posting.id)}/applicants`;
  const posted = formatPostedDate(posting.createdAt);
  const deadline = deadlineText(posting.applicationDeadline ?? null);
  const expired = posting.status === "Open" && posting.isExpired === true;
  const applicantCount = posting.applicantCount ?? 0;
  const pay = formatPayRange(
    posting.compensation?.min ?? null,
    posting.compensation?.max ?? null,
    "per month",
  );
  const showPay = pay !== null;

  const items: MenuItem[] = [];
  if (posting.status === "Open") {
    items.push({
      key: "pause",
      label: "Pause opening",
      icon: <Pause className="size-[18px]" aria-hidden />,
      onSelect: () => onStatus("Paused"),
    });
  } else if (posting.status === "Paused") {
    items.push({
      key: "reopen",
      label: "Reopen opening",
      icon: <Play className="size-[18px]" aria-hidden />,
      onSelect: () => onStatus("Open"),
    });
  }
  if (!closed) {
    items.push({
      key: "close",
      label: "Close opening",
      icon: <Lock className="size-[18px]" aria-hidden />,
      tone: "destructive",
      separatorBefore: true,
      onSelect: onAskClose,
    });
  }

  return (
    <article
      className={cn(
        "relative flex flex-col gap-4 rounded-2xl border bg-card p-5 pl-6 shadow-sm sm:p-6 sm:pl-7",
        closed && "opacity-70",
        posting.status === "Paused" && "opacity-[0.88]",
      )}
      style={{ borderColor: "var(--border)" }}
      aria-busy={busy}
    >
      {/* Status accent bar */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[5px] rounded-l-2xl",
          expired
            ? "bg-danger"
            : posting.status === "Open"
              ? "bg-success"
              : posting.status === "Paused"
                ? "bg-warning"
                : "bg-muted-foreground",
        )}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <KindPill kind={posting.kind} />
            {expired ? (
              <StatusPill status={posting.status} expired icon={AlertTriangle} />
            ) : (
              <StatusPill
                status={posting.status}
                icon={posting.status === "Paused" ? Pause : posting.status === "Closed" ? Lock : undefined}
              />
            )}
          </div>
          {posted ? (
            <span className="text-[13px] font-medium text-muted-foreground">
              Posted {posted}
            </span>
          ) : null}
        </div>
        <h2 className="font-heading text-[20px] font-semibold leading-snug text-foreground sm:text-[22px]">
          {posting.title}
        </h2>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Meta icon={<Building2 className="size-4" aria-hidden />}>
          {posting.companyName}
        </Meta>
        <Meta icon={<MapPin className="size-4" aria-hidden />}>
          {workModeAndLocation(posting.workMode, posting.location)}
        </Meta>
        {deadline.kind !== "none" ? (
          <Meta
            icon={<Calendar className="size-4" aria-hidden />}
            className={
              expired || deadline.kind === "past" || deadline.kind === "today" || deadline.kind === "soon"
                ? "font-bold text-warning"
                : "text-muted-foreground"
            }
            weight={deadline.kind === "soon" || deadline.kind === "today" || deadline.kind === "past" || expired ? "bold" : "medium"}
          >
            {deadline.text}
          </Meta>
        ) : null}
        <Meta icon={<Users className="size-4" aria-hidden />}>
          {formatOpenings(posting.openings)}
        </Meta>
        {showPay ? (
          <Meta icon={<Banknote className="size-4" aria-hidden />}>{pay}</Meta>
        ) : null}
      </div>

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

      {posting.status === "Paused" ? (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-[10px] bg-warning-soft px-3.5 py-2.5 text-[14px] font-semibold text-warning"
        >
          <AlertTriangle className="mt-[2px] size-4 shrink-0" aria-hidden />
          Paused. Students cannot see this opening.
        </p>
      ) : null}

      {expired ? (
        <p
          role="status"
          className="flex items-start gap-2.5 rounded-[10px] bg-danger-soft px-3.5 py-2.5 text-[14px] font-semibold text-danger"
        >
          <AlertTriangle className="mt-[2px] size-4 shrink-0" aria-hidden />
          The deadline has passed. Students no longer see this opening.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <Button asChild variant="outline" size="lg" className="h-11 border-[1.5px] border-primary bg-background px-4 text-primary">
          <Link href={applicantsHref}>
            <Users className="size-[18px]" aria-hidden />
            View applicants ({applicantCount})
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-11 px-4">
          <Link href={editHref}>
            <Pencil className="size-[18px]" aria-hidden />
            {closed ? "View" : "Edit"}
          </Link>
        </Button>
        <div className="ml-auto" />
        {items.length > 0 ? (
          <Menu
            triggerLabel="More actions"
            triggerIcon={<MoreHorizontal className="size-5" aria-hidden />}
            items={items}
            disabled={anyBusy || busy}
          />
        ) : null}
      </div>
    </article>
  );
}

function Meta({
  icon,
  children,
  className,
  weight = "medium",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  weight?: "medium" | "bold";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[14px] text-muted-foreground",
        weight === "bold" ? "font-bold" : "font-medium",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}