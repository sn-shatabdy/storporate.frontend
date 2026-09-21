"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ChevronLeft, MessageSquare } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import type {
  ConversationDetail,
  ConversationSummary,
} from "@/lib/api/outreach";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { JobsListSkeleton } from "@/components/jobs/job-states";

import { ConversationCard } from "./conversation-card";
import { OutreachEmptyState } from "./states";
import { ConversationThread, type ThreadRole } from "./thread";

/** The page shell used by every outreach page. */
export function OutreachPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        {children}
      </div>
    </div>
  );
}

export interface ConversationListViewProps {
  title: string;
  subtitle: string;
  loadingLabel: string;
  errorTitle: string;
  emptyTitle: string;
  emptyMessage?: string;
  load: (
    token: string,
    signal: AbortSignal,
  ) => Promise<{ items: ConversationSummary[] }>;
  hrefFor: (id: string) => string;
}

/** A list of conversations for either side. */
export function ConversationListView({
  title,
  subtitle,
  loadingLabel,
  errorTitle,
  emptyTitle,
  emptyMessage,
  load,
  hrefFor,
}: ConversationListViewProps) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [items, setItems] = useState<ConversationSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      setFailed(false);
      try {
        const result = await load(accessToken, controller.signal);
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
  }, [accessToken, version]);

  return (
    <OutreachPageShell>
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{subtitle}</p>
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
        <OutreachEmptyState
          icon={MessageSquare}
          title={emptyTitle}
          message={emptyMessage}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((conversation) => (
            <li key={conversation.id}>
              <ConversationCard
                conversation={conversation}
                href={hrefFor(conversation.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </OutreachPageShell>
  );
}

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; conversation: ConversationDetail }
  | { kind: "notFound" }
  | { kind: "error" };

export interface ConversationPageViewProps {
  role: ThreadRole;
  id: string | undefined;
  backHref: string;
  backLabel: string;
  loadingLabel: string;
  load: (token: string, id: string, signal: AbortSignal) => Promise<ConversationDetail>;
  send: (token: string, id: string, message: string) => Promise<ConversationDetail>;
  decline?: (token: string, id: string) => Promise<ConversationDetail>;
}

/** One conversation page for either side. Fetches, sends and declines. */
export function ConversationPageView({
  role,
  id,
  backHref,
  backLabel,
  loadingLabel,
  load,
  send,
  decline,
}: ConversationPageViewProps) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [version, setVersion] = useState(0);
  const [sending, setSending] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !id) return;
    const controller = new AbortController();
    (async () => {
      setState({ kind: "loading" });
      try {
        const conversation = await load(accessToken, id, controller.signal);
        if (controller.signal.aborted) return;
        setState({ kind: "loaded", conversation });
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.errorCode === "outreach_not_found") {
          setState({ kind: "notFound" });
        } else {
          setState({ kind: "error" });
        }
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id, version]);

  /** Refresh quietly after a rule error so the screen matches the server. */
  const refresh = useCallback(async () => {
    if (!accessToken || !id) return;
    try {
      const conversation = await load(accessToken, id, new AbortController().signal);
      setState({ kind: "loaded", conversation });
    } catch {
      // Keep what is on screen.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id]);

  const onSend = useCallback(
    async (message: string): Promise<boolean> => {
      if (!accessToken || !id || sending) return false;
      setSending(true);
      setError(null);
      try {
        const conversation = await send(accessToken, id, message);
        setState({ kind: "loaded", conversation });
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.errorCode === "outreach_awaiting_reply") {
          setError("Waiting for the student to reply.");
          void refresh();
        } else if (e instanceof ApiError && e.errorCode === "outreach_declined") {
          setError(
            role === "employer"
              ? "This student declined. You cannot send more messages."
              : "You declined this invitation.",
          );
          void refresh();
        } else if (e instanceof ApiError && e.errorCode === "outreach_message_invalid") {
          setError("Write a message of 1 to 2000 characters.");
        } else {
          setError("Could not send your message. Try again.");
        }
        return false;
      } finally {
        setSending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, id, sending, role, refresh],
  );

  const onDecline = useCallback(async () => {
    if (!accessToken || !id || !decline || declining) return;
    setDeclining(true);
    setError(null);
    try {
      const conversation = await decline(accessToken, id);
      setState({ kind: "loaded", conversation });
    } catch {
      setError("Could not decline this invitation. Try again.");
    } finally {
      setDeclining(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id, declining]);

  return (
    <OutreachPageShell>
      {state.kind === "loading" ? (
        <>
          <BackLink href={backHref} label={backLabel} />
          <JobsListSkeleton label={loadingLabel} />
        </>
      ) : state.kind === "notFound" ? (
        <>
          <BackLink href={backHref} label={backLabel} />
          <OutreachEmptyState
            icon={MessageSquare}
            title="This conversation was not found"
            message="It may have been removed. Go back to your list."
          />
        </>
      ) : state.kind === "error" ? (
        <>
          <BackLink href={backHref} label={backLabel} />
          <AdvisorErrorState
            title="Could not load this conversation"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        </>
      ) : (
        <ConversationThread
          role={role}
          conversation={state.conversation}
          backHref={backHref}
          backLabel={backLabel}
          sending={sending}
          declining={declining}
          error={error}
          onSend={onSend}
          onDecline={decline ? onDecline : undefined}
        />
      )}
    </OutreachPageShell>
  );
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <ChevronLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
