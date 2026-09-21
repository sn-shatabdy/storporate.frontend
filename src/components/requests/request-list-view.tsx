"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HandCoins } from "lucide-react";

import type { RequestStatus, RequestSummary } from "@/lib/api/sponsorshipRequests";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { OutreachEmptyState } from "@/components/outreach/states";
import { OutreachPageShell } from "@/components/outreach/conversation-views";
import { useSession } from "next-auth/react";

import { RequestCard } from "./request-card";
import { STATUS_FILTERS } from "./request-helpers";
import type { RequestSide } from "./request-thread";

export interface RequestListViewProps {
  side: RequestSide;
  title: string;
  subtitle: string;
  loadingLabel: string;
  errorTitle: string;
  emptyTitle: string;
  emptyMessage: string;
  emptyAction?: ReactNode;
  load: (
    token: string,
    status: RequestStatus | null,
    signal: AbortSignal,
  ) => Promise<{ items: RequestSummary[] }>;
  hrefFor: (id: string) => string;
}

/** A filterable list of sponsorship requests for either side. */
export function RequestListView({
  side,
  title,
  subtitle,
  loadingLabel,
  errorTitle,
  emptyTitle,
  emptyMessage,
  emptyAction,
  load,
  hrefFor,
}: RequestListViewProps) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [status, setStatus] = useState<RequestStatus | null>(null);
  const [items, setItems] = useState<RequestSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      setFailed(false);
      try {
        const result = await load(accessToken, status, controller.signal);
        if (controller.signal.aborted) return;
        setItems(result.items);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
      }
    })();
    return () => controller.abort();
    // `load` is a stable module function supplied by each page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, status, version]);

  function choose(next: RequestStatus | null) {
    if (next === status) return;
    setItems(null);
    setFailed(false);
    setStatus(next);
  }

  const filtered = status !== null;

  return (
    <OutreachPageShell>
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
      </div>

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const pressed = filter.value === status;
          return (
            <button
              key={filter.label}
              type="button"
              aria-pressed={pressed}
              onClick={() => choose(filter.value)}
              className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                pressed
                  ? "border-primary bg-primary font-semibold text-primary-foreground"
                  : "border-input bg-background font-medium text-foreground hover:bg-secondary"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {failed && items === null ? (
        <AdvisorErrorState
          title={errorTitle}
          message="Check your connection and try again."
          onRetry={() => setVersion((v) => v + 1)}
        />
      ) : items === null ? (
        <JobsListSkeleton label={loadingLabel} />
      ) : items.length === 0 ? (
        filtered ? (
          <OutreachEmptyState
            icon={HandCoins}
            title="No requests with this status."
            message="Try another status or show all requests."
            action={
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="mt-1 h-10 sm:h-9"
                onClick={() => choose(null)}
              >
                Show all
              </Button>
            }
          />
        ) : (
          <OutreachEmptyState
            icon={HandCoins}
            title={emptyTitle}
            message={emptyMessage}
            action={emptyAction}
          />
        )
      ) : (
        <>
          <p role="status" className="sr-only">
            {items.length} {items.length === 1 ? "request" : "requests"} shown.
          </p>
          <ul className="flex flex-col gap-3" aria-label="Requests">
            {items.map((request) => (
              <li key={request.id}>
                <RequestCard
                  request={request}
                  href={hrefFor(request.id)}
                  highlightNew={side === "Company"}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </OutreachPageShell>
  );
}
