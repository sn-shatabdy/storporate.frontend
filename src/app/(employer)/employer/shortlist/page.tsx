"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Bookmark } from "lucide-react";

import {
  listShortlist,
  removeFromShortlist,
  type ConversationDetail,
  type ShortlistEntry,
} from "@/lib/api/outreach";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { OutreachEmptyState } from "@/components/outreach/states";
import { ShortlistCard } from "@/components/outreach/shortlist-card";
import { Button } from "@/components/ui/button";

/** `/employer/shortlist`: students the employer saved. The (employer) layout
 *  owns the authorization gate. */
export default function ShortlistPage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [items, setItems] = useState<ShortlistEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      setFailed(false);
      try {
        const result = await listShortlist(accessToken, controller.signal);
        if (controller.signal.aborted) return;
        setItems(result.items);
      } catch {
        if (controller.signal.aborted) return;
        setFailed(true);
      }
    })();
    return () => controller.abort();
  }, [accessToken, version]);

  const remove = useCallback(
    async (entry: ShortlistEntry) => {
      if (!accessToken || removingId) return;
      setRemovingId(entry.candidateId);
      setErrors((prev) => {
        const next = { ...prev };
        delete next[entry.candidateId];
        return next;
      });
      try {
        await removeFromShortlist(accessToken, entry.candidateId);
        setItems((prev) =>
          prev ? prev.filter((e) => e.candidateId !== entry.candidateId) : prev,
        );
      } catch {
        setErrors((prev) => ({
          ...prev,
          [entry.candidateId]: "Could not remove this student. Try again.",
        }));
      } finally {
        setRemovingId(null);
      }
    },
    [accessToken, removingId],
  );

  const invited = useCallback(
    (entry: ShortlistEntry, conversation: ConversationDetail) => {
      setItems((prev) =>
        prev
          ? prev.map((e) =>
              e.candidateId === entry.candidateId
                ? {
                    ...e,
                    conversation: {
                      id: conversation.id,
                      status: conversation.status,
                    },
                  }
                : e,
            )
          : prev,
      );
    },
    [],
  );

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Your shortlist
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Students you saved. Invite one to start a conversation.
          </p>
        </div>

        {failed && items === null ? (
          <AdvisorErrorState
            title="Could not load your shortlist"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : items === null ? (
          <JobsListSkeleton label="Loading your shortlist." />
        ) : items.length === 0 ? (
          <OutreachEmptyState
            icon={Bookmark}
            title="No one saved yet."
            message="Save students from your search results to keep them here."
            action={
              <Button asChild size="lg" className="mt-1 h-10 px-4 sm:h-9">
                <Link href="/employer/search">Search</Link>
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <p
              className="text-xs font-medium text-muted-foreground"
              aria-live="polite"
            >
              {items.length === 1 ? "1 student" : `${items.length} students`}
            </p>
            <ul className="flex flex-col gap-3">
              {items.map((entry) => (
                <li key={entry.candidateId}>
                  <ShortlistCard
                    entry={entry}
                    removing={removingId === entry.candidateId}
                    error={errors[entry.candidateId] ?? null}
                    onRemove={() => remove(entry)}
                    onInvited={(c) => invited(entry, c)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
