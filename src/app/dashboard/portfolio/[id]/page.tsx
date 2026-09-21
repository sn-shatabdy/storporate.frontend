"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemSharingCard } from "@/components/portfolio/item-sharing-card";
import { ApiError } from "@/lib/api/errors";
import { getSearchableProfile } from "@/lib/api/discovery";
import {
  PORTFOLIO_CATEGORIES,
  getPortfolioItemAnalysis,
  listPortfolioItems,
  retryPortfolioItemAnalysis,
  type PortfolioItem,
  type PortfolioItemAnalysis,
} from "@/lib/api/portfolio";
import {
  styleForAnalysisStatus,
  styleForConfidenceBand,
  type AnalysisStatus,
  type ConfidenceBand,
} from "@/lib/portfolio/analysis-status";
import { cn } from "cn";

const PAGE_SIZE = 100;

/** Same shape as the list row's `CATEGORY_LABEL_BY_VALUE` — duplicated here
 * (rather than imported across the page boundary) because it's a 3-line
 * constant and the list page doesn't currently export it. */
const CATEGORY_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  PORTFOLIO_CATEGORIES.map((c) => [c.value, c.label]),
);

/** Mirrors `secondaryLineFor()` from the list page — file name (+ size) for
 * file submissions, the URL host for link submissions, with fallbacks. */
function secondaryLineFor(item: PortfolioItem): string {
  if (item.submissionType === "File") {
    if (item.originalFileName) {
      const size = item.fileSizeBytes ?? 0;
      if (size > 0) {
        return `${item.originalFileName} · ${formatFileSize(size)}`;
      }
      return item.originalFileName;
    }
    return "File";
  }
  if (item.externalUrl) {
    try {
      return new URL(item.externalUrl).host;
    } catch {
      return item.externalUrl;
    }
  }
  return "Link";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** "Sep 14, 2026" — locale-aware short date, no time-of-day. Same formatter
 * as the list page; duplicated here because the list page keeps it local to
 * its module. */
function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type DetailState =
  | { status: "loading" }
  | { status: "success"; item: PortfolioItem; analysis: PortfolioItemAnalysis }
  | { status: "notFound" }
  | { status: "error"; message: string };

/** Visibility state for the per-item sharing card. Fetches the student's
 *  `searchable-profile` alongside the item. Loaded INDEPENDENTLY of
 *  `detail` — a failure to load the profile (network blip, transient
 *  5xx, etc.) must NOT break the page; we treat it as `isSearchable=false`
 *  so the card renders its locked-off "Turn on employer visibility to use
 *  this." state instead. The student can still see every other part of
 *  the item, and the lock can be cleared later by reloading the page once
 *  the backend is healthy. */
type SharingState =
  | { status: "loading" }
  | { status: "ready"; isSearchable: boolean };

const POLL_INTERVAL_MS = 4000;

/**
 * Per-portfolio-item detail page (`/dashboard/portfolio/[id]`) — shows the
 * item's metadata header card and the current state of its AI analysis. The
 * four visible content cards below the header correspond to the four
 * terminal/non-terminal statuses the analysis pipeline can report; while the
 * status is `NotAnalyzed` or `Analyzing` the page polls every 4s until a
 * terminal status lands. The Failed card includes a working "Retry analysis"
 * button that re-queues the item and flips it back to NotAnalyzed.
 *
 * The page is a client component (this app doesn't use server actions and
 * every existing data-fetching page uses the same useState/useEffect +
 * AbortController pattern as `portfolio/page.tsx`).
 *
 * Item metadata lookup strategy: there's no dedicated `GET /api/portfolio/
 * items/{id}` single-item endpoint, so the page calls `listPortfolioItems`
 * (the same one-page `PAGE_SIZE = 100` fetch the list page already uses)
 * alongside `getPortfolioItemAnalysis` via `Promise.all`. If the item isn't
 * in the first page of items (i.e. the student has >100 items, or the item
 * belongs to a different account), the lookup returns `notFound` and the
 * page renders a centered message with a back link.
 */
export default function PortfolioItemDetailPage() {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;

  const params = useParams<{ id: string }>();
  const id = params?.id;

  // Bumped after a successful retry so the analysis effect re-runs and
  // immediately re-fetches (otherwise we'd wait up to POLL_INTERVAL_MS for
  // the next tick to pick up the NotAnalyzed → Analyzing transition).
  const [refreshVersion, setRefreshVersion] = useState(0);

  // `retrying` disables the Retry button and swaps its icon to a spinner
  // while the POST is in flight, mirroring the `submitting` pattern on the
  // list page's "Add to portfolio" button.
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const [detail, setDetail] = useState<DetailState>({ status: "loading" });

  // STOR-44 Phase 3: per-item sharing-card state. Fetched on mount
  // alongside the item+analysis so the card is ready to render as soon
  // as the item has loaded. Failures degrade to isSearchable=false
  // (locked-off disabled state) — see SharingState comment above.
  const [sharing, setSharing] = useState<SharingState>({ status: "loading" });

  // Initial fetch: parallel listPortfolioItems (to find the item's metadata)
  // + getPortfolioItemAnalysis (for the analysis rollup). Either 404 → the
  // not-found state; any other ApiError → a user-readable message.
  //
  // Stale-while-revalidate on re-entry: when this effect re-runs because of
  // a successful Retry (which bumps `refreshVersion`), the prior `detail`
  // is still a valid `success` snapshot — we let it stay rendered until
  // the fresh Promise.all result lands, then swap it in directly. This
  // avoids blanking the header card + back link down to a generic
  // "Loading…" placeholder mid-interaction. The first-mount case (where
  // `detail.status` is still its initial `"loading"`) keeps the original
  // behaviour: show the full-page loading placeholder until the fetch
  // resolves. `detail` is intentionally NOT a dep — re-running on every
  // state change would defeat the abort-on-cleanup pattern.
  useEffect(() => {
    if (!accessToken || !id) return;
    const controller = new AbortController();
    const tokenAtMount = accessToken;
    // Capture once, synchronously, before the async IIFE — `detail` itself
    // is not a dep so this snapshot is what holds at the moment the effect
    // was scheduled, not "what detail looks like by the time the promise
    // resolves".
    const hadPriorSuccess = detail.status === "success";

    (async () => {
      if (!hadPriorSuccess) {
        setDetail({ status: "loading" });
      }
      try {
        const [listResult, analysis] = await Promise.all([
          listPortfolioItems(1, PAGE_SIZE, tokenAtMount, controller.signal),
          getPortfolioItemAnalysis(id, tokenAtMount, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const item = listResult.items.find((it) => it.id === id);
        if (!item) {
          setDetail({ status: "notFound" });
          return;
        }
        setDetail({ status: "success", item, analysis });
      } catch (error) {
        if (controller.signal.aborted) return;
        // 404 on the analysis endpoint (item doesn't exist or isn't the
        // caller's) — surface as the same not-found state the list-lookup
        // miss uses, so a 404 item isn't shown as an "error" with a retry
        // button.
        if (error instanceof ApiError && error.status === 404) {
          setDetail({ status: "notFound" });
          return;
        }
        setDetail({
          status: "error",
          message:
            error instanceof Error ? error.message : "Something went wrong.",
        });
      }
    })();

    return () => controller.abort();
    // `detail.status` is intentionally NOT a dep — we capture it
    // synchronously at the top of the effect (`hadPriorSuccess`) to
    // implement the stale-while-revalidate pattern. Adding it here would
    // re-run the fetch on every successful setDetail() (including the
    // polling tick's own setDetail), creating an infinite fetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, id, refreshVersion]);

  // Sharing-card profile fetch effect. Independent of the main detail
  // fetch so the item can render even if the profile endpoint is
  // transient-down. On failure we settle into `{ status: "ready",
  // isSearchable: false }` so the ItemSharingCard renders its disabled
  // state — same UX as a student who simply hasn't turned on employer
  // visibility. Re-runs when `refreshVersion` bumps (Retry) or when the
  // student saves the profile elsewhere; doesn't re-run on `sharingVersion`
  // (a successful item-sharing PUT doesn't affect the profile).
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    const tokenAtMount = accessToken;
    (async () => {
      try {
        const profile = await getSearchableProfile(
          tokenAtMount,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setSharing({ status: "ready", isSearchable: profile.isSearchable });
      } catch {
        if (controller.signal.aborted) return;
        // Fail-open to "not searchable" — the card will render the
        // locked-off state and the rest of the page is unaffected.
        setSharing({ status: "ready", isSearchable: false });
      }
    })();
    return () => controller.abort();
  }, [accessToken, refreshVersion]);

  // Polling effect: while status is NotAnalyzed or Analyzing, re-fetch the
  // analysis every POLL_INTERVAL_MS until a terminal status arrives. Clears
  // itself on unmount AND as soon as the status becomes terminal (no point
  // continuing to poll once the result is in).
  //
  // Depends on `shouldPoll` (a stable boolean), NOT on the whole `detail`
  // object — depending on `detail` directly tore down and recreated the
  // interval on every successful poll tick (because each tick writes a new
  // `analysis` object with a fresh `skills` array reference). A boolean dep
  // gives the interval a stable identity across polls and only re-arms when
  // the boolean actually flips (i.e., when the status crosses the
  // non-terminal → terminal boundary, or vice versa after a retry).
  const shouldPoll =
    detail.status === "success" &&
    (detail.analysis.status === "NotAnalyzed" ||
      detail.analysis.status === "Analyzing");

  useEffect(() => {
    if (!accessToken || !id) return;
    if (!shouldPoll) return;

    let cancelled = false;
    let currentController: AbortController | null = null;

    const interval = setInterval(() => {
      // Abort any in-flight fetch from the previous tick before kicking off
      // the next one — same "abort the prior fetch on cleanup" pattern the
      // list page's primary useEffect uses.
      if (currentController) currentController.abort();
      currentController = new AbortController();
      const signal = currentController.signal;
      const tokenAtTick = accessToken;
      const itemIdAtTick = id;

      (async () => {
        try {
          const next = await getPortfolioItemAnalysis(
            itemIdAtTick,
            tokenAtTick,
            signal,
          );
          if (cancelled || signal.aborted) return;
          // Functional updater — reads the LATEST detail, not the closure's
          // snapshot from when this effect started running. This is what
          // makes it safe for the interval to have a stable identity across
          // many poll ticks: the tick only writes, never reads, `detail`.
          setDetail((prev) =>
            prev.status === "success"
              ? { status: "success", item: prev.item, analysis: next }
              : prev,
          );
        } catch {
          // Swallow abort + transient network errors silently; the next
          // tick will try again. A persistent failure surfaces via the
          // next non-poll fetch (retry / remount) rather than via this loop.
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (currentController) currentController.abort();
    };
  }, [accessToken, id, shouldPoll]);

  async function handleRetry() {
    if (!accessToken || !id) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await retryPortfolioItemAnalysis(id, accessToken);
      // Backend has reset the item to NotAnalyzed server-side — bump the
      // refresh version so the main fetch effect re-runs immediately and
      // the UI flips to the loading card without waiting for the next
      // poll tick.
      setRefreshVersion((v) => v + 1);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // Race — the item's status moved on before our retry landed
        // (someone else already retried it, or the pipeline auto-retried).
        // Resync the displayed state so we don't leave a stale Failed card
        // up if the real status has already moved past it, and surface the
        // backend's message verbatim for context.
        setRetryError(error.message);
        setRefreshVersion((v) => v + 1);
      } else if (error instanceof ApiError) {
        setRetryError(error.message);
      } else if (error instanceof Error) {
        setRetryError(error.message);
      } else {
        setRetryError("Something went wrong. Please try again.");
      }
    } finally {
      setRetrying(false);
    }
  }

  // STOR-44 Phase 3 — fired by ItemSharingCard when its PUT succeeds.
  // Updates the local item so the card itself (and any other place that
  // reads the flag) sees the new value without re-fetching the whole
  // page. The list-page pill is reconciled by the list-page's own
  // effect when it next refetches; we don't bump refreshVersion here
  // because that would re-run BOTH the analysis polling effect AND the
  // sharing profile effect unnecessarily — a flag flip changes neither.
  function handleSharingChanged(updatedItem: PortfolioItem) {
    setDetail((prev) =>
      prev.status === "success"
        ? { ...prev, item: updatedItem }
        : prev,
    );
  }

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (detail.status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (detail.status === "notFound") {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[820px] flex-col items-center gap-4 text-center">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            This item couldn&apos;t be found.
          </h1>
          <Link
            href="/dashboard/portfolio"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to portfolio
          </Link>
        </div>
      </div>
    );
  }

  if (detail.status === "error") {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 text-center">
          <Link
            href="/dashboard/portfolio"
            className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to portfolio
          </Link>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            We couldn&apos;t load this item.
          </h1>
          <p className="text-sm text-muted-foreground">{detail.message}</p>
        </div>
      </div>
    );
  }

  const { item, analysis } = detail;
  const categoryLabel = CATEGORY_LABEL_BY_VALUE[item.category] ?? item.category;
  // Use the analysis as the source of truth for the header badge — the list
  // row's `analysisStatus` and the detail endpoint's `status` should always
  // agree, but the detail endpoint is fresher once it's loaded.
  const statusStyle = styleForAnalysisStatus(analysis.status as AnalysisStatus);
  const StatusIcon = statusStyle.icon;
  const isAnalyzing = analysis.status === "Analyzing";

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-8">
        <Link
          href="/dashboard/portfolio"
          className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to portfolio
        </Link>

        <header
          className="flex items-start gap-4 border bg-card p-5"
          style={{ borderRadius: 16, borderColor: "var(--border)" }}
        >
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"
          >
            {item.submissionType === "File" ? (
              <FileText className="size-5" />
            ) : (
              <Link2 className="size-5" />
            )}
          </span>
          <div className="min-w-0 flex-1 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="font-heading text-[22px] font-semibold text-foreground">
                {item.label}
              </h1>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--accent-foreground)",
                }}
              >
                {categoryLabel}
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {secondaryLineFor(item)}
            </p>
            <p className="text-xs text-muted-foreground">
              Added {formatCreatedAt(item.createdAt)}
              {analysis.lastAnalyzedAt
                ? ` · Last analyzed ${formatCreatedAt(analysis.lastAnalyzedAt)}`
                : ""}
            </p>
          </div>
          <Badge
            background={statusStyle.background}
            color={statusStyle.color}
            className="flex-shrink-0"
          >
            <StatusIcon className={cn("size-3", isAnalyzing && "animate-spin")} />
            {statusStyle.label}
          </Badge>
        </header>

        {/* STOR-44 Phase 3 — per-item "Employer access" card. Rendered
            below the item header and above the analysis content (per
            the approved canvas). Hidden until BOTH the item has loaded
            AND the searchable-profile endpoint has settled — the
            profile fetch degrades to isSearchable=false on failure so
            the card still renders, just in its locked-off state. */}
        {accessToken && (
          <ItemSharingCard
            item={{
              id: item.id,
              submissionType: item.submissionType,
              originalFileName: item.originalFileName,
              shareOriginalWithEmployers: item.shareOriginalWithEmployers,
            }}
            isSearchable={
              sharing.status === "ready" ? sharing.isSearchable : false
            }
            accessToken={accessToken}
            onChanged={handleSharingChanged}
          />
        )}

        <DetailContent
          analysis={analysis}
          retrying={retrying}
          retryError={retryError}
          onRetry={handleRetry}
        />
      </div>
    </div>
  );
}

interface DetailContentProps {
  analysis: PortfolioItemAnalysis;
  retrying: boolean;
  retryError: string | null;
  onRetry: () => void;
}

/** Picks which of the four content cards to render based on `analysis.status`.
 * Extracted so the parent page component stays focused on data fetching /
 * state management. */
function DetailContent({ analysis, retrying, retryError, onRetry }: DetailContentProps) {
  if (
    analysis.status === "NotAnalyzed" ||
    analysis.status === "Analyzing"
  ) {
    return <AnalyzingCard />;
  }
  if (analysis.status === "Analyzed") {
    return <AnalyzedCard analysis={analysis} />;
  }
  if (analysis.status === "Unsupported") {
    return <UnsupportedCard />;
  }
  return <FailedCard analysis={analysis} retrying={retrying} retryError={retryError} onRetry={onRetry} />;
}

function AnalyzingCard() {
  // Icon circle colors come from the shared status map (same single source
  // of truth the header badge reads) so a future tweak in analysis-status.ts
  // flows through automatically instead of silently drifting here.
  const tone = styleForAnalysisStatus("Analyzing");
  return (
    <div
      className="flex flex-col items-center gap-4 border bg-card p-12 text-center"
      style={{ borderRadius: 16, borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className="flex size-13 items-center justify-center rounded-full"
        style={{ backgroundColor: tone.background, color: tone.color }}
      >
        <Loader2 className="size-6 animate-spin" />
      </span>
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Analyzing your submission…
      </h2>
      <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
        This usually takes under a minute. We&apos;ll update this page
        automatically once it&apos;s done — no need to refresh.
      </p>
    </div>
  );
}

interface AnalyzedCardProps {
  analysis: PortfolioItemAnalysis;
}

function AnalyzedCard({ analysis }: AnalyzedCardProps) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Skills found
        </h2>
        <span className="text-xs font-medium text-muted-foreground">
          {analysis.skills.length === 1
            ? "1 skill"
            : `${analysis.skills.length} skills`}
        </span>
      </div>

      {analysis.skills.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No specific skills were identified.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {analysis.skills.map((skill, idx) => {
            const bandStyle = styleForConfidenceBand(
              skill.confidenceBand as ConfidenceBand,
            );
            return (
              <div
                key={`${skill.skillName}-${idx}`}
                className="flex flex-col gap-2 border bg-card p-5"
                style={{ borderRadius: 14, borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-heading text-[15px] font-semibold text-foreground">
                    {skill.skillName}
                  </span>
                  <Badge
                    background={bandStyle.background}
                    color={bandStyle.color}
                  >
                    {bandStyle.label}
                  </Badge>
                </div>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {skill.explanation}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function UnsupportedCard() {
  // Icon circle colors come from the shared status map — same source of
  // truth the header badge reads (see comment on AnalyzingCard).
  const tone = styleForAnalysisStatus("Unsupported");
  return (
    <div
      className="flex flex-col items-center gap-4 border bg-card p-12 text-center"
      style={{ borderRadius: 16, borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className="flex size-13 items-center justify-center rounded-full"
        style={{ backgroundColor: tone.background, color: tone.color }}
      >
        <Ban className="size-6" />
      </span>
      <h2 className="font-heading text-lg font-semibold text-foreground">
        We can&apos;t analyze this file type yet
      </h2>
      <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
        Video and design files aren&apos;t analyzed automatically right now.
        You can still keep this in your portfolio — try adding a text file,
        document, or link instead if you&apos;d like AI feedback on it.
      </p>
    </div>
  );
}

interface FailedCardProps {
  analysis: PortfolioItemAnalysis;
  retrying: boolean;
  retryError: string | null;
  onRetry: () => void;
}

function FailedCard({ analysis, retrying, retryError, onRetry }: FailedCardProps) {
  // Icon circle colors come from the shared status map — same source of
  // truth the header badge reads (see comment on AnalyzingCard).
  const tone = styleForAnalysisStatus("Failed");
  const body =
    analysis.errorMessage && analysis.errorMessage.trim().length > 0
      ? analysis.errorMessage
      : "We couldn't finish analyzing this file.";
  return (
    <div
      className="flex flex-col items-center gap-4 border bg-card p-12 text-center"
      style={{ borderRadius: 16, borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className="flex size-13 items-center justify-center rounded-full"
        style={{ backgroundColor: tone.background, color: tone.color }}
      >
        <AlertTriangle className="size-6" />
      </span>
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Analysis failed
      </h2>
      <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
        {body}
      </p>
      <Button onClick={onRetry} disabled={retrying}>
        {retrying ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        Retry analysis
      </Button>
      {retryError && (
        <p role="alert" className="text-sm text-destructive">
          {retryError}
        </p>
      )}
    </div>
  );
}
