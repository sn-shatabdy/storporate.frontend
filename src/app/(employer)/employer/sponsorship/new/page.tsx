"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";

import { createGoalSet, type SponsorshipGoalSetRequest } from "@/lib/api/sponsorship";
import { GoalForm } from "@/components/sponsorship/goal-form";

/** `/employer/sponsorship/new`: create a goal set. */
export default function NewGoalSetPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  async function handleSubmit(request: SponsorshipGoalSetRequest) {
    if (!accessToken) throw new Error("Not signed in");
    await createGoalSet(accessToken, request);
    router.push("/employer/sponsorship?saved=created");
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
            New goal set
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Tell clubs what you want before they ask.
          </p>
        </div>
        <GoalForm
          submitLabel="Create goal set"
          cancelHref="/employer/sponsorship"
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
