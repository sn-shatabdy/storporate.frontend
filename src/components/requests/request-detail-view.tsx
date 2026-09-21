"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CheckCircle2, ChevronLeft, HandCoins, ThumbsDown, ThumbsUp } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import type { CompleteRequestInput, RequestDetail } from "@/lib/api/sponsorshipRequests";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { initialsOf } from "@/components/clubs/club-helpers";
import { OutreachPageShell } from "@/components/outreach/conversation-views";
import { OutreachEmptyState } from "@/components/outreach/states";

import { AcceptDialog, CompleteDialog, DeclineDialog } from "./action-dialogs";
import {
  formatAmount,
  formatDay,
  hasAction,
  isStaleRequestError,
  messageForRequestError,
} from "./request-helpers";
import { RequestProgress } from "./request-progress";
import { RequestSummarySections } from "./request-sections";
import { RequestThread, type RequestSide } from "./request-thread";
import { RequestStatusPill } from "./status-pill";

type LoadState =
  | { kind: "loading" }
  | { kind: "loaded"; request: RequestDetail }
  | { kind: "notFound" }
  | { kind: "error" };

type DialogKind = "accept" | "decline" | "complete" | null;

export interface RequestDetailViewProps {
  side: RequestSide;
  id: string | undefined;
  backHref: string;
  backLabel: string;
  loadingLabel: string;
  load: (token: string, id: string, signal?: AbortSignal) => Promise<RequestDetail>;
  send: (token: string, id: string, body: string) => Promise<RequestDetail>;
  complete: (token: string, id: string, input: CompleteRequestInput) => Promise<RequestDetail>;
  /** Company only. */
  accept?: (token: string, id: string, note: string) => Promise<RequestDetail>;
  /** Company only. */
  decline?: (token: string, id: string, reason: string) => Promise<RequestDetail>;
}

/**
 * One request for either side. Every button and the composer come from the
 * server's `allowedActions`. After any action the screen shows the request
 * the server returned.
 */
export function RequestDetailView({
  side,
  id,
  backHref,
  backLabel,
  loadingLabel,
  load,
  send,
  complete,
  accept,
  decline,
}: RequestDetailViewProps) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [version, setVersion] = useState(0);
  const [sending, setSending] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [statusLine, setStatusLine] = useState("");
  const [dialog, setDialog] = useState<DialogKind>(null);

  useEffect(() => {
    if (!accessToken || !id) return;
    const controller = new AbortController();
    (async () => {
      setState({ kind: "loading" });
      try {
        const request = await load(accessToken, id, controller.signal);
        if (controller.signal.aborted) return;
        setState({ kind: "loaded", request });
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.errorCode === "sponsorship_request_not_found") {
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
      const request = await load(accessToken, id);
      setState({ kind: "loaded", request });
    } catch {
      // Keep what is on screen.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id]);

  const onSend = useCallback(
    async (body: string): Promise<boolean> => {
      if (!accessToken || !id || sending) return false;
      setSending(true);
      setThreadError(null);
      setStatusLine("");
      try {
        const request = await send(accessToken, id, body);
        setState({ kind: "loaded", request });
        setStatusLine("Message sent.");
        return true;
      } catch (e) {
        setThreadError(messageForRequestError(e, "message"));
        if (isStaleRequestError(e)) void refresh();
        return false;
      } finally {
        setSending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accessToken, id, sending, refresh],
  );

  /** Run one action for a dialog. Throws so the dialog can show the error. */
  async function runAction(work: () => Promise<RequestDetail>, done: string) {
    setStatusLine("");
    try {
      const request = await work();
      setState({ kind: "loaded", request });
      setStatusLine(done);
    } catch (e) {
      if (isStaleRequestError(e)) void refresh();
      throw e;
    }
  }

  return (
    <OutreachPageShell>
      <BackLink href={backHref} label={backLabel} />
      {state.kind === "loading" ? (
        <JobsListSkeleton label={loadingLabel} />
      ) : state.kind === "notFound" ? (
        <OutreachEmptyState
          icon={HandCoins}
          title="This request was not found"
          message="It may have been removed. Go back to your list."
        />
      ) : state.kind === "error" ? (
        <AdvisorErrorState
          title="Could not load this request"
          message="Check your connection and try again."
          onRetry={() => setVersion((v) => v + 1)}
        />
      ) : (
        <Loaded
          side={side}
          request={state.request}
          sending={sending}
          threadError={threadError}
          statusLine={statusLine}
          onSend={onSend}
          onOpen={setDialog}
        />
      )}

      {state.kind === "loaded" && dialog === "accept" && accept && accessToken && id ? (
        <AcceptDialog
          onClose={() => setDialog(null)}
          onSubmit={(note) => runAction(() => accept(accessToken, id, note), "Request accepted.")}
        />
      ) : null}
      {state.kind === "loaded" && dialog === "decline" && decline && accessToken && id ? (
        <DeclineDialog
          onClose={() => setDialog(null)}
          onSubmit={(reason) =>
            runAction(() => decline(accessToken, id, reason), "Request declined.")
          }
        />
      ) : null}
      {state.kind === "loaded" && dialog === "complete" && accessToken && id ? (
        <CompleteDialog
          onClose={() => setDialog(null)}
          onSubmit={(input) =>
            runAction(() => complete(accessToken, id, input), "Marked as completed.")
          }
        />
      ) : null}
    </OutreachPageShell>
  );
}

function Loaded({
  side,
  request,
  sending,
  threadError,
  statusLine,
  onSend,
  onOpen,
}: {
  side: RequestSide;
  request: RequestDetail;
  sending: boolean;
  threadError: string | null;
  statusLine: string;
  onSend: (body: string) => Promise<boolean>;
  onOpen: (kind: DialogKind) => void;
}) {
  const club = side === "Club";
  const canAccept = hasAction(request.allowedActions, "accept");
  const canDecline = hasAction(request.allowedActions, "decline");
  const canComplete = hasAction(request.allowedActions, "complete");
  const canMessage = hasAction(request.allowedActions, "message");
  const hasButtons = canAccept || canDecline || canComplete;

  const counterpart = club ? request.company.name : request.club.name;
  const subtitle = club
    ? `To ${request.company.name}, ${request.company.goalName}`
    : `From ${request.club.name}, ${request.club.university}`;
  const amount = formatAmount(request.amountRequested);
  const eventDate = formatDay(request.eventDate);
  const sent = formatDay(request.createdAt);

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Request summary"
        className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent font-heading text-base font-semibold text-primary"
          >
            {initialsOf(counterpart)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
              <h1 className="min-w-0 break-words font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
                {request.eventTitle}
              </h1>
              <RequestStatusPill status={request.status} />
            </div>
            <p className="mt-1 break-words text-sm text-muted-foreground sm:text-base">{subtitle}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {[sent ? `Sent ${sent}` : "", eventDate ? `Event ${eventDate}` : "", amount ?? ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        {hasButtons ? (
          <div
            className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:flex-wrap"
            style={{ borderColor: "var(--border)" }}
          >
            {canAccept ? (
              <Button
                type="button"
                size="lg"
                className="h-10 sm:h-9"
                disabled={sending}
                onClick={() => onOpen("accept")}
              >
                <ThumbsUp className="size-4" aria-hidden />
                Accept
              </Button>
            ) : null}
            {canDecline ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 sm:h-9"
                disabled={sending}
                onClick={() => onOpen("decline")}
              >
                <ThumbsDown className="size-4" aria-hidden />
                Decline
              </Button>
            ) : null}
            {canComplete ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10 sm:h-9"
                disabled={sending}
                onClick={() => onOpen("complete")}
              >
                <CheckCircle2 className="size-4" aria-hidden />
                Mark as completed
              </Button>
            ) : null}
          </div>
        ) : null}

        <p
          role="status"
          aria-live="polite"
          className={statusLine ? "text-sm font-medium text-[#1e7b34]" : "sr-only"}
        >
          {statusLine}
        </p>
      </section>

      <section
        aria-labelledby="request-progress-title"
        className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 id="request-progress-title" className="font-heading text-lg font-semibold text-foreground">
          Progress
        </h2>
        <RequestProgress
          status={request.status}
          dates={{
            Sent: request.createdAt,
            Viewed: request.viewedAt,
            Agreed: request.decidedAt,
            Declined: request.decidedAt,
            Completed: request.completedAt,
          }}
        />
      </section>

      <RequestSummarySections request={request} side={side} />

      <RequestThread
        viewer={side}
        messages={request.messages}
        clubName={request.club.name}
        companyName={request.company.name}
        canMessage={canMessage}
        sending={sending}
        error={threadError}
        onSend={onSend}
        composerLabel={club ? "Send" : "Ask a question"}
        placeholder={club ? "Write a message" : "Ask the club a question"}
      />
    </div>
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
