"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import { getCompanyGoal, type CompanyGoalDetail } from "@/lib/api/sponsorship";
import { createRequest, type CreateRequestInput } from "@/lib/api/sponsorshipRequests";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { GoalContextCard, RequestForm } from "@/components/requests/request-form";
import { SponsorshipEmptyState } from "@/components/sponsorship/sponsorship-pieces";
import { Button } from "@/components/ui/button";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; goal: CompanyGoalDetail }
  | { kind: "notFound" }
  | { kind: "error" };

/** `/club/sponsors/{id}/request`: ask one company to back one event. */
export default function RequestSponsorshipPage() {
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
        const goal = await getCompanyGoal(accessToken, id, controller.signal);
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

  async function handleSubmit(input: CreateRequestInput) {
    if (!accessToken) throw new Error("Not signed in");
    const created = await createRequest(accessToken, input);
    router.push(`/club/requests/${encodeURIComponent(created.id)}`);
  }

  const backHref = id ? `/club/sponsors/${encodeURIComponent(id)}` : "/club/sponsors";

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {state.kind === "loaded" ? state.goal.companyName : "Sponsors"}
          </Link>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Request sponsorship
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Ask this company to back one of your events.
          </p>
        </div>

        {state.kind === "loading" ? (
          <JobsListSkeleton label="Loading the goal set." />
        ) : state.kind === "notFound" ? (
          <SponsorshipEmptyState
            title="This goal set is not available."
            message="The company may have paused or removed it. Go back to the sponsor list."
            action={
              <Button asChild variant="outline" size="lg" className="mt-1 h-10 sm:h-9">
                <Link href="/club/sponsors">Back to sponsors</Link>
              </Button>
            }
          />
        ) : state.kind === "error" ? (
          <AdvisorErrorState
            title="Could not load this goal set"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : (
          <>
            <GoalContextCard goal={state.goal} />
            <RequestForm
              goalId={state.goal.id}
              cancelHref={backHref}
              onSubmit={handleSubmit}
              onGoalMissing={() => setState({ kind: "notFound" })}
            />
          </>
        )}
      </div>
    </div>
  );
}
