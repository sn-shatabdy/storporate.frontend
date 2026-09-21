"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  getGoalSet,
  updateGoalSet,
  type SponsorshipGoalSetRequest,
  type SponsorshipGoalSetResponse,
} from "@/lib/api/sponsorship";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { GoalForm } from "@/components/sponsorship/goal-form";
import { valuesFromGoalSet } from "@/components/sponsorship/sponsorship-helpers";
import { SponsorshipEmptyState } from "@/components/sponsorship/sponsorship-pieces";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; goal: SponsorshipGoalSetResponse }
  | { kind: "notFound" }
  | { kind: "error" };

/** `/employer/sponsorship/{id}/edit`: change a goal set. */
export default function EditGoalSetPage() {
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
        const goal = await getGoalSet(accessToken, id, controller.signal);
        if (controller.signal.aborted) return;
        setState({ kind: "loaded", goal });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.errorCode === "sponsorship_goal_not_found") {
          setState({ kind: "notFound" });
        } else {
          setState({ kind: "error" });
        }
      }
    })();
    return () => controller.abort();
  }, [accessToken, id, version]);

  async function handleSubmit(request: SponsorshipGoalSetRequest) {
    if (!accessToken || !id) throw new Error("Not signed in");
    await updateGoalSet(accessToken, id, request);
  }

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <Link
            href="/employer/sponsorship"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Sponsorship goals
          </Link>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Edit goal set
          </h1>
        </div>

        {state.kind === "loading" ? (
          <JobsListSkeleton label="Loading the goal set." />
        ) : state.kind === "notFound" ? (
          <SponsorshipEmptyState
            title="Goal set not found"
            message="It may have been deleted. Go back to your goal sets."
          />
        ) : state.kind === "error" ? (
          <AdvisorErrorState
            title="Could not load this goal set"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : (
          <GoalForm
            initialValues={valuesFromGoalSet(state.goal)}
            submitLabel="Save changes"
            cancelHref="/employer/sponsorship"
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}
