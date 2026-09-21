"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { CheckCircle2, Plus, X } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  deleteGoalSet,
  listGoalSets,
  setGoalSetStatus,
  type SponsorshipGoalSetResponse,
} from "@/lib/api/sponsorship";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { GoalSetCard } from "@/components/sponsorship/goal-set-card";
import {
  messageForSponsorshipError,
  nextStatus,
} from "@/components/sponsorship/sponsorship-helpers";
import { SponsorshipEmptyState } from "@/components/sponsorship/sponsorship-pieces";

const FLASH_MESSAGES: Record<string, string> = {
  created: "Goal set created.",
};

/** `/employer/sponsorship`: the company's own sponsorship goal sets. The
 *  (employer) layout owns the authorization gate. */
export default function EmployerSponsorshipPage() {
  return (
    <Suspense fallback={null}>
      <EmployerSponsorshipInner />
    </Suspense>
  );
}

function EmployerSponsorshipInner() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<SponsorshipGoalSetResponse[] | null>(null);
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
      router.replace(pathname ?? "/employer/sponsorship");
    }
  }, [flash, searchParams, router, pathname]);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      setFailed(false);
      try {
        const result = await listGoalSets(accessToken, controller.signal);
        if (controller.signal.aborted) return;
        setItems(result.items);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
      }
    })();
    return () => controller.abort();
  }, [accessToken, version]);

  const toggleStatus = useCallback(
    async (goal: SponsorshipGoalSetResponse) => {
      if (!accessToken || busyId) return;
      const status = nextStatus(goal.status);
      setBusyId(goal.id);
      setActionError(null);
      setFlash(null);
      try {
        const updated = await setGoalSetStatus(accessToken, goal.id, status);
        setItems((prev) =>
          prev
            ? prev.map((g) =>
                g.id === goal.id ? { ...g, ...(updated ?? {}), status } : g,
              )
            : prev,
        );
      } catch (error) {
        setActionError(messageForSponsorshipError(error, "status"));
        if (error instanceof ApiError && error.status === 404) {
          setVersion((v) => v + 1);
        }
      } finally {
        setBusyId(null);
      }
    },
    [accessToken, busyId],
  );

  const remove = useCallback(
    async (goal: SponsorshipGoalSetResponse) => {
      if (!accessToken || busyId) return;
      setBusyId(goal.id);
      setActionError(null);
      setFlash(null);
      try {
        await deleteGoalSet(accessToken, goal.id);
        setItems((prev) => (prev ? prev.filter((g) => g.id !== goal.id) : prev));
        setConfirmId(null);
      } catch (error) {
        setActionError(messageForSponsorshipError(error, "delete"));
        if (error instanceof ApiError && error.status === 404) {
          setConfirmId(null);
          setVersion((v) => v + 1);
        }
      } finally {
        setBusyId(null);
      }
    },
    [accessToken, busyId],
  );

  const newButton = (
    <Button asChild size="lg" className="h-10 w-full px-4 sm:h-9 sm:w-auto">
      <Link href="/employer/sponsorship/new">
        <Plus className="size-4" aria-hidden />
        New goal set
      </Link>
    </Button>
  );

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Sponsorship goals
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              What you want from sponsoring student activity.
            </p>
          </div>
          {newButton}
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
            title="Could not load your goal sets"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : items === null ? (
          <JobsListSkeleton label="Loading your goal sets." />
        ) : items.length === 0 ? (
          <SponsorshipEmptyState
            title="No goal sets yet"
            message="A goal set tells clubs what you want from a sponsorship, such as who you want to reach and which events you would back."
            action={
              <Button asChild size="lg" className="mt-1 h-10 px-4 sm:h-9">
                <Link href="/employer/sponsorship/new">
                  <Plus className="size-4" aria-hidden />
                  New goal set
                </Link>
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Goal sets">
            {items.map((goal) => (
              <li key={goal.id}>
                <GoalSetCard
                  goal={goal}
                  busy={busyId === goal.id}
                  anyBusy={busyId !== null}
                  confirming={confirmId === goal.id}
                  onToggleStatus={() => toggleStatus(goal)}
                  onAskDelete={() => {
                    setActionError(null);
                    setConfirmId(goal.id);
                  }}
                  onCancelDelete={() => setConfirmId(null)}
                  onDelete={() => remove(goal)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
