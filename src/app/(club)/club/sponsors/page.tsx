"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Search } from "lucide-react";

import {
  EVENT_KINDS,
  listCompanyGoals,
  OBJECTIVES,
  type CompanyGoalFilters,
  type CompanyGoalSummary,
} from "@/lib/api/sponsorship";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { CompanyGoalCard } from "@/components/sponsorship/company-goal-card";
import { SponsorshipEmptyState } from "@/components/sponsorship/sponsorship-pieces";

const DEBOUNCE_MS = 350;
const LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const SELECT =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40";

/** `/club/sponsors`: what companies want from sponsoring. The (club) layout
 *  owns the authorization gate. */
export default function ClubSponsorsPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [q, setQ] = useState("");
  const [objective, setObjective] = useState("");
  const [eventKind, setEventKind] = useState("");
  const [filters, setFilters] = useState<CompanyGoalFilters>({});
  const [items, setItems] = useState<CompanyGoalSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((prev) => {
          const next = { q: q.trim(), objective, eventKind };
          const same =
            (prev.q ?? "") === next.q &&
            (prev.objective ?? "") === next.objective &&
            (prev.eventKind ?? "") === next.eventKind;
          return same ? prev : next;
        }),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [q, objective, eventKind]);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setFailed(false);
      try {
        const result = await listCompanyGoals(accessToken, filters, controller.signal);
        if (controller.signal.aborted) return;
        setItems(result.items);
        setLoading(false);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [accessToken, filters, version]);

  const hasFilters = Boolean(q.trim() || objective || eventKind);

  function clearFilters() {
    setQ("");
    setObjective("");
    setEventKind("");
  }

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Sponsors
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            What companies want from sponsoring, so you know before you ask.
          </p>
        </div>

        <div
          role="search"
          className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sponsors-search" className={LABEL}>
              Search
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="sponsors-search"
                type="search"
                value={q}
                placeholder="Company or goal name"
                className="pl-8"
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sponsors-objective" className={LABEL}>
                Objective
              </label>
              <select
                id="sponsors-objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className={SELECT}
              >
                <option value="">All</option>
                {OBJECTIVES.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sponsors-event-kind" className={LABEL}>
                Event kind
              </label>
              <select
                id="sponsors-event-kind"
                value={eventKind}
                onChange={(e) => setEventKind(e.target.value)}
                className={SELECT}
              >
                <option value="">All</option>
                {EVENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {hasFilters ? (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="h-9 px-2"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            </div>
          ) : null}
        </div>

        {failed && items === null ? (
          <AdvisorErrorState
            title="Could not load sponsors"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : items === null ? (
          <JobsListSkeleton label="Loading sponsors." />
        ) : (
          <>
            {failed ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border bg-[#fbe9e7] p-4 text-sm text-foreground"
                style={{ borderColor: "rgba(179,38,30,0.25)" }}
              >
                <span>Could not update the list. Check your connection and try again.</span>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-9 bg-white"
                  onClick={() => setVersion((v) => v + 1)}
                >
                  Try again
                </Button>
              </div>
            ) : null}
            {items.length === 0 ? (
              <SponsorshipEmptyState
                title={hasFilters ? "No sponsors match." : "No sponsors yet."}
                message={
                  hasFilters
                    ? "Try a different search or clear the filters."
                    : "Companies show up here when they share what they want from sponsoring."
                }
                action={
                  hasFilters ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="mt-1 h-10 sm:h-9"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="flex flex-col gap-3" aria-busy={loading} aria-label="Sponsors">
                {items.map((goal) => (
                  <li key={goal.id}>
                    <CompanyGoalCard goal={goal} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
