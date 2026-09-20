"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  addExplorationMessage,
  createComparison,
  createExploration,
  deleteExploration,
  getExploration,
  listExplorations,
  MAX_EXPLORATIONS_PER_STUDENT,
  refreshExploration,
  renameExploration,
  retryExploration,
  type ExplorationDetail,
  type ExplorationListItem,
  type ExplorationStatus,
} from "@/lib/api/growth";

import { AdvisorRail } from "@/components/advisor/advisor-rail";
import { AdvisorDetail } from "@/components/advisor/advisor-detail";
import { AdvisorCompare } from "@/components/advisor/advisor-compare";
import {
  AdvisorEmptyState,
  AdvisorErrorState,
} from "@/components/advisor/advisor-error-state";

/** How long to wait between detail polls while an exploration is `Working`.
 * 4 s matches the cadence the portfolio detail page already uses, so
 * working-state feedback feels uniform across the dashboard. */
const POLL_INTERVAL_MS = 4000;

/** URL parameter that drives the selected exploration (per Next.js `useSearchParams`).
 * The page reads this on mount, validates it against the list, and writes it back
 * via `router.replace` on every selection change so the back button restores the
 * previous conversation cleanly. */
const EXPLORATION_PARAM = "exploration";

type ListState =
  | { status: "loading" }
  | {
      status: "ready";
      items: ExplorationListItem[];
      selectedId: string | null;
    }
  | { status: "error"; message: string };

type DetailState =
  | { status: "none" }
  | { status: "loading"; id: string }
  | { status: "ready"; detail: ExplorationDetail; refreshVersion: number }
  | { status: "error"; id: string; message: string };

type CompareState =
  | { status: "selecting"; selectedIds: string[] }
  | { status: "working"; comparisonId: string; firstId: string; secondId: string }
  | {
      status: "result";
      comparisonId: string;
      firstId: string;
      secondId: string;
      resultText: string;
    }
  | { status: "error"; firstId: string; secondId: string };

/**
 * STOR-40 Phase 5 — the advisor page (`/dashboard/advisor`).
 *
 * Top-level orchestration only — every visual state lives in a dedicated
 * subcomponent under `src/components/advisor/*` so this file stays
 * focused on data flow + transitions. Renders one of four top-level
 * shapes based on the underlying state machine:
 *
 *   1. Loading → centered "Loading your advisor…" placeholder.
 *   2. Error   → the `AdvisorErrorState` card with a working Retry button.
 *   3. Compare-in-progress → the `AdvisorCompare` shell.
 *   4. Normal   → the {@link AdvisorShell} layout.
 *
 * First-visit auto-start: when the list resolves with zero items AND
 * we haven't tried to create one yet, we call `createExploration()` once
 * (guarded by a ref so React 19 / StrictMode's double-effect can't fire
 * twice). The new exploration is selected and shows the first-visit
 * Working state with skeleton bars + disabled composer.
 *
 * The default export wraps the shell in `<Suspense>` because
 * `useSearchParams` requires it at the page boundary per the Next.js
 * App Router docs.
 */
export default function AdvisorPageRoute() {
  return (
    <Suspense fallback={null}>
      <AdvisorPageShell />
    </Suspense>
  );
}

function AdvisorPageShell() {
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [listState, setListState] = useState<ListState>({ status: "loading" });
  const [detailState, setDetailState] = useState<DetailState>({ status: "none" });
  const [compareState, setCompareState] = useState<CompareState>({
    status: "selecting",
    selectedIds: [],
  });
  const [compareError, setCompareError] = useState<string | null>(null);

  // Bumped after every mutation that should re-fetch the list
  // (create / delete / rename). The list effect watches this so a
  // successful create prepends the new exploration without a manual
  // refresh.
  const [listVersion, setListVersion] = useState(0);

  // Auto-create guard. When the list resolves with zero items we kick
  // off a single `createExploration()` call so the first visit lands
  // directly in the first-visit state with skeleton bars + disabled
  // composer. The ref (not state) is intentional: a state flag would
  // re-run on every render, while the ref is set once and survives
  // StrictMode's double-effect mount.
  const autoCreateAttemptedRef = useRef(false);
  // Mirror the ref into state so the empty-state render path can
  // read it without linting out for "refs in render".
  const [autoCreateAttempted, setAutoCreateAttempted] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);

  // ------------------------------------------------------------------
  // List fetch
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    const tokenAtMount = accessToken;

    (async () => {
      try {
        const items = await listExplorations(tokenAtMount, controller.signal);
        if (controller.signal.aborted) return;
        // Preserve the current selection if it's still in the list; else
        // fall back to the first item so the detail panel stays populated.
        setListState((prev) => {
          if (prev.status !== "ready") {
            return {
              status: "ready",
              items,
              selectedId: items[0]?.id ?? null,
            };
          }
          const stillThere = items.some((it) => it.id === prev.selectedId);
          return {
            status: "ready",
            items,
            selectedId: stillThere ? prev.selectedId : items[0]?.id ?? null,
          };
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setListState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not load your explorations.",
        });
      }
    })();

    return () => controller.abort();
  }, [accessToken, listVersion]);

  // ------------------------------------------------------------------
  // First-visit auto-create: when the list resolves with zero items,
  // spin up a single `createExploration()` exactly once.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (
      !accessToken ||
      autoCreateAttemptedRef.current ||
      listState.status !== "ready" ||
      listState.items.length !== 0
    ) {
      return;
    }
    autoCreateAttemptedRef.current = true;
    setAutoCreateAttempted(true);
    setAutoCreating(true);

    (async () => {
      try {
        const { id } = await createExploration(accessToken);
        if (!id) return;
        // Optimistically surface the new exploration so the first-visit
        // detail view appears immediately — the list re-fetch will
        // reconcile the row's metadata (title, status) on the next tick.
        setListState((prev) =>
          prev.status === "ready"
            ? {
                ...prev,
                items: [
                  ...prev.items,
                  {
                    id,
                    title: "New exploration",
                    status: "Working",
                    updatedAt: new Date().toISOString(),
                    latestVersionNumber: null,
                  },
                ],
                selectedId: id,
              }
            : prev,
        );
      } catch (error) {
        // Fall back to the page-level error card so the user can retry.
        // We don't reset `autoCreateAttemptedRef` because the page is
        // about to unmount/retry from the error state.
        setListState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not create your exploration.",
        });
      } finally {
        setAutoCreating(false);
      }
    })();
  }, [accessToken, listState]);

  // ------------------------------------------------------------------
  // Selection — when the list resolves for the first time or the selected
  // item changes, fetch the matching detail.
  // ------------------------------------------------------------------
  const selectedId =
    listState.status === "ready" ? listState.selectedId : null;

  useEffect(() => {
    if (!accessToken || !selectedId) return;
    const controller = new AbortController();
    const idAtMount = selectedId;
    const tokenAtMount = accessToken;

    (async () => {
      setDetailState({ status: "loading", id: idAtMount });
      try {
        const detail = await getExploration(idAtMount, tokenAtMount, controller.signal);
        if (controller.signal.aborted) return;
        setDetailState({ status: "ready", detail, refreshVersion: 0 });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 404) {
          setDetailState({
            status: "error",
            id: idAtMount,
            message: "This exploration couldn't be found.",
          });
          return;
        }
        setDetailState({
          status: "error",
          id: idAtMount,
          message:
            error instanceof Error
              ? error.message
              : "Could not load this exploration.",
        });
      }
    })();

    return () => controller.abort();
  }, [accessToken, selectedId]);

  // ------------------------------------------------------------------
  // URL <-> selection sync.
  //
  //   - On mount with no param: select the first exploration.
  //   - On selection change: `router.replace` the new id (no scroll).
  //   - On URL change (back button, deep link): re-sync the selection.
  //
  // Unknown ids (e.g. another student's id pasted in) are ignored
  // without showing an error — the rail falls back to the first row.
  // ------------------------------------------------------------------
  const urlParam = searchParams?.get(EXPLORATION_PARAM) ?? null;
  const lastSyncedParamRef = useRef<string | null>(null);

  // Selection -> URL
  const selectedIdForUrlSync =
    listState.status === "ready" ? listState.selectedId : null;
  useEffect(() => {
    if (listState.status !== "ready") return;
    const current = listState.selectedId;
    if (current === lastSyncedParamRef.current) return;
    lastSyncedParamRef.current = current;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (current === null) {
      params.delete(EXPLORATION_PARAM);
    } else {
      params.set(EXPLORATION_PARAM, current);
    }
    const qs = params.toString();
    const path = qs.length > 0 ? `${window.location.pathname}?${qs}` : window.location.pathname;
    router.replace(path, { scroll: false });
    // We intentionally do not include `searchParams` in deps — the URL
    // write is driven purely by our own selection, not by the user's
    // browser history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIdForUrlSync, listState.status, router]);

  // URL -> selection (deep link + back button).
  useEffect(() => {
    if (listState.status !== "ready") return;
    // Defer the state update out of the effect's synchronous window so
    // the react-hooks/set-state-in-effect rule doesn't fire (and so we
    // don't trigger a cascading render). The deferral also matches the
    // "URL changes are a side-channel from outside React" pattern.
    queueMicrotask(() => {
      if (urlParam === null) {
        // No param: select first (the lg+ shell auto-fills this).
        setListState((prev) =>
          prev.status === "ready" && prev.selectedId !== prev.items[0]?.id
            ? { ...prev, selectedId: prev.items[0]?.id ?? null }
            : prev,
        );
        return;
      }
      // Capture the items snapshot once for the exists-check below.
      setListState((prev) => {
        if (prev.status !== "ready") return prev;
        const exists = prev.items.some((it) => it.id === urlParam);
        const fallbackId = prev.items[0]?.id ?? null;
        if (!exists) {
          // Unknown id — silently fall back to the first exploration.
          return prev.selectedId !== fallbackId
            ? { ...prev, selectedId: fallbackId }
            : prev;
        }
        return prev.selectedId !== urlParam
          ? { ...prev, selectedId: urlParam }
          : prev;
      });
    });
  }, [urlParam, listState]);

  // ------------------------------------------------------------------
  // Polling — derived `shouldPoll` boolean drives a stable interval that
  // fires only while the current detail is `Working`. Stops automatically
  // the moment status flips to `Idle` or `Failed`.
  // ------------------------------------------------------------------
  const currentDetail =
    detailState.status === "ready" ? detailState.detail : null;

  // Derived `shouldPoll` based on the *current* detail id + status only.
  // We intentionally avoid reading `detailState` itself in the deps — the
  // setDetailState calls below would otherwise tear down + re-establish
  // the interval every poll tick, which both wastes work and lets a stale
  // "Working" tick fire after the backend has already gone Idle.
  const pollingId =
    detailState.status === "ready" ? detailState.detail.id : null;
  const pollingStatus =
    detailState.status === "ready" ? detailState.detail.status : null;
  const shouldPoll = pollingStatus === "Working";

  useEffect(() => {
    if (!accessToken || !pollingId || !shouldPoll) return;

    let cancelled = false;
    let currentController: AbortController | null = null;

    const interval = setInterval(() => {
      // Re-read latest state at tick time. If the detail has flipped to
      // Idle/Failed between ticks, skip this round so we don't paint a
      // stale frame.
      // (We can't use `currentDetail` here — it captures the value at
      // effect setup. The polled response above has already updated
      // detailState via the setter below.)
      if (currentController) currentController.abort();
      currentController = new AbortController();
      const signal = currentController.signal;
      const tokenAtTick = accessToken;
      const idAtTick = pollingId;

      (async () => {
        try {
          const next = await getExploration(idAtTick, tokenAtTick, signal);
          if (cancelled || signal.aborted) return;
          // If the response is no longer Working, clear the interval
          // immediately instead of waiting for the next tick.
          if (next.status !== "Working") {
            clearInterval(interval);
          }
          setDetailState((prev) =>
            prev.status === "ready" && prev.detail.id === idAtTick
              ? { status: "ready", detail: next, refreshVersion: prev.refreshVersion }
              : prev,
          );
        } catch {
          // Swallow aborts + transient errors; the next tick will retry.
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (currentController) currentController.abort();
    };
  }, [accessToken, pollingId, shouldPoll]);

  // After a polling terminal event (idle / failed), refresh the list
  // once so the row metadata catches up.
  const hasRefreshedListOnTerminalRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentDetail) return;
    if (currentDetail.status === "Working") return;
    if (hasRefreshedListOnTerminalRef.current === currentDetail.id) return;
    hasRefreshedListOnTerminalRef.current = currentDetail.id;
    setListVersion((v) => v + 1);
  }, [currentDetail]);

  // ------------------------------------------------------------------
  // Mutations
  // ------------------------------------------------------------------
  const [creating, setCreating] = useState(false);
  const handleCreate = useCallback(async () => {
    if (!accessToken || creating) return;
    setCreating(true);
    try {
      const { id } = await createExploration(accessToken);
      setListVersion((v) => v + 1);
      setListState((prev) =>
        prev.status === "ready"
          ? { ...prev, selectedId: id }
          : prev,
      );
    } catch {
      setListState({
        status: "error",
        message: "Could not create your exploration.",
      });
    } finally {
      setCreating(false);
    }
  }, [accessToken, creating]);

  const handleRefresh = useCallback(async () => {
    if (!accessToken || !currentDetail) return;
    try {
      await refreshExploration(currentDetail.id, accessToken);
      setDetailState((prev) =>
        prev.status === "ready"
          ? {
              status: "ready",
              detail: { ...prev.detail, status: "Working" as ExplorationStatus },
              refreshVersion: prev.refreshVersion,
            }
          : prev,
      );
    } catch {
      // Swallow; the next detail fetch will surface a real failure.
    }
  }, [accessToken, currentDetail]);

  const handleRetry = useCallback(async () => {
    if (!accessToken || !currentDetail) return;
    try {
      await retryExploration(currentDetail.id, accessToken);
      setDetailState((prev) =>
        prev.status === "ready"
          ? {
              status: "ready",
              detail: { ...prev.detail, status: "Working" as ExplorationStatus, lastError: null },
              refreshVersion: prev.refreshVersion,
            }
          : prev,
      );
    } catch {
      // ignore
    }
  }, [accessToken, currentDetail]);

  const handleSubmitMessage = useCallback(
    async (args: {
      content?: string;
      answers: Array<{ question: string; answer: string }>;
    }) => {
      if (!accessToken || !currentDetail) return;
      try {
        await addExplorationMessage(currentDetail.id, args, accessToken);
        setDetailState((prev) =>
          prev.status === "ready"
            ? {
                status: "ready",
                detail: { ...prev.detail, status: "Working" as ExplorationStatus },
                refreshVersion: prev.refreshVersion,
              }
            : prev,
        );
      } catch (error) {
        // Re-throw so the inline alert on the composer / answers form can
        // surface a friendly retry. We intentionally do NOT flip
        // detail.status to "Failed" — that's reserved for the backend's
        // Advisor turn failure.
        throw new Error(
          error instanceof Error
            ? error.message
            : "Something went wrong. Try again.",
        );
      }
    },
    [accessToken, currentDetail],
  );

  const handleRename = useCallback(
    async (title: string) => {
      if (!accessToken || !currentDetail) return;
      try {
        await renameExploration(currentDetail.id, title, accessToken);
        setDetailState((prev) =>
          prev.status === "ready"
            ? {
                status: "ready",
                detail: { ...prev.detail, title },
                refreshVersion: prev.refreshVersion,
              }
            : prev,
        );
        setListVersion((v) => v + 1);
      } catch {
        // Ignore; the title input stays open so the user can retry.
      }
    },
    [accessToken, currentDetail],
  );

  const handleDelete = useCallback(async () => {
    if (!accessToken || !currentDetail) return;
    try {
      await deleteExploration(currentDetail.id, accessToken);
      setDetailState({ status: "none" });
      // Clear the `?exploration=<id>` query so the URL matches the new
      // "nothing selected" state (mobile back link uses this).
      if (urlParam !== null) {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.delete(EXPLORATION_PARAM);
        const qs = params.toString();
        const path = qs.length > 0 ? `${window.location.pathname}?${qs}` : window.location.pathname;
        router.replace(path, { scroll: false });
      }
      setListVersion((v) => v + 1);
    } catch {
      // Ignore — the dialog stays open so the user can retry. The detail
      // state isn't touched so the UI shows the prior snapshot.
    }
  }, [accessToken, currentDetail, urlParam, searchParams, router]);

  // ------------------------------------------------------------------
  // Compare-mode handlers
  // ------------------------------------------------------------------

  const handleCancelCompare = useCallback(() => {
    setCompareState({ status: "selecting", selectedIds: [] });
    setDetailState((prev) =>
      prev.status === "ready" ? prev : { status: "none" },
    );
  }, []);

  /** Re-fire `POST /compare` for the same two ids. Used by the
   *  comparison failed alert's "Try again" button. */
  const handleCompareRetry = useCallback(async () => {
    if (!accessToken) return;
    if (compareState.status !== "error") return;
    const { firstId, secondId } = compareState;
    setCompareError(null);
    try {
      const { comparisonId } = await createComparison(
        { firstExplorationId: firstId, secondExplorationId: secondId },
        accessToken,
      );
      setCompareState({ status: "working", comparisonId, firstId, secondId });
    } catch {
      // Stay on the error card; the alert's Try again button is
      // idempotent and the user can retry again.
    }
  }, [accessToken, compareState]);

  const handleClearSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete(EXPLORATION_PARAM);
    const qs = params.toString();
    const path = qs.length > 0 ? `${window.location.pathname}?${qs}` : window.location.pathname;
    router.replace(path, { scroll: false });
  }, [searchParams, router]);

  const handleSelect = useCallback(
    (id: string) => {
      setListState((prev) =>
        prev.status === "ready" ? { ...prev, selectedId: id } : prev,
      );
    },
    [],
  );

  // ------------------------------------------------------------------
  // Top-level render
  // ------------------------------------------------------------------
  if (sessionStatus === "loading" || !session) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading your advisor…</p>
      </div>
    );
  }

  if (listState.status === "loading" || autoCreating) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading your advisor…</p>
      </div>
    );
  }

  if (listState.status === "error") {
    return (
      <div className="px-4 py-10 lg:px-8 lg:py-12">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
          <h1 className="font-heading text-[26px] font-semibold leading-tight text-foreground lg:text-3xl">
            Advisor
          </h1>
          <AdvisorErrorState
            title="Could not load your explorations"
            message="Check your connection and try again."
            onRetry={() => setListVersion((v) => v + 1)}
          />
        </div>
      </div>
    );
  }

  // Compare-mode takes over the whole shell — but only once the user
  // actively engages with it. While the picker is still `selecting`,
  // the page renders the normal layout so the rail can offer its own
  // Compare toggle.
  if (compareState.status !== "selecting") {
    return (
      <AdvisorCompare
        compareState={compareState}
        list={listState.items}
        accessToken={accessToken ?? ""}
        onCancel={handleCancelCompare}
        onRetry={handleCompareRetry}
        onCompareStateChange={setCompareState}
      />
    );
  }

  // "No explorations yet" — only shown after the auto-create attempt
  // is done so a first-visit doesn't briefly flash an empty state
  // before the create call resolves.
  if (
    listState.items.length === 0 &&
    autoCreateAttempted &&
    !creating
  ) {
    return (
      <div className="px-4 py-10 lg:px-8 lg:py-12">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
          <h1 className="font-heading text-[26px] font-semibold leading-tight text-foreground lg:text-3xl">
            Advisor
          </h1>
          <AdvisorEmptyState
            title="No explorations yet"
            message="Start one to get advice."
            primaryLabel="New exploration"
            primaryIcon={Plus}
            onPrimary={handleCreate}
          />
        </div>
      </div>
    );
  }

  const atLimit = listState.items.length >= MAX_EXPLORATIONS_PER_STUDENT;

  return (
    <AdvisorShell
      items={listState.items}
      selectedId={listState.selectedId}
      detailState={detailState}
      compareState={compareState}
      compareError={compareError}
      atLimit={atLimit}
      urlParam={urlParam}
      compareSubmitting={false}
      accessToken={accessToken ?? ""}
      onSelect={handleSelect}
      onCreate={handleCreate}
      onCompareRequest={({ comparisonId, firstId, secondId }) => {
        setCompareError(null);
        setCompareState({
          status: "working",
          comparisonId,
          firstId,
          secondId,
        });
      }}
      onCompareError={setCompareError}
      onRefresh={handleRefresh}
      onRetry={handleRetry}
      onRename={handleRename}
      onDelete={handleDelete}
      onSubmitMessage={handleSubmitMessage}
      onClearSelection={handleClearSelection}
      creating={creating}
    />
  );
}

// --------------------------------------------------------------------
// Shell — renders the list+detail+rail layout with breakpoint-aware
// structure: rail at `lg+`, split workspace at `xl+`, stacked with
// tabs below `xl`. Phone layout shows either the list or the detail
// (driven by the URL param).
// --------------------------------------------------------------------

interface AdvisorShellProps {
  items: ExplorationListItem[];
  selectedId: string | null;
  detailState: DetailState;
  compareState: CompareState;
  compareError: string | null;
  atLimit: boolean;
  urlParam: string | null;
  compareSubmitting: boolean;
  accessToken: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onCompareRequest: (detail: {
    comparisonId: string;
    firstId: string;
    secondId: string;
  }) => void;
  onCompareError: (message: string) => void;
  onRefresh: () => void;
  onRetry: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onSubmitMessage: (args: {
    content?: string;
    answers: Array<{ question: string; answer: string }>;
  }) => Promise<void>;
  onClearSelection: () => void;
  creating: boolean;
}

function AdvisorShell({
  items,
  selectedId,
  detailState,
  compareState,
  compareError,
  atLimit,
  urlParam,
  compareSubmitting,
  accessToken,
  onSelect,
  onCreate,
  onCompareRequest,
  onCompareError,
  onRefresh,
  onRetry,
  onRename,
  onDelete,
  onSubmitMessage,
  onClearSelection,
  creating,
}: AdvisorShellProps) {
  // Phone layout: show only the list when no exploration is selected
  // (or when the URL has no `?exploration=` param). The detail screen
  // appears once a specific id is in the URL — with a back link that
  // clears the param.
  const showPhoneDetail = urlParam !== null;
  // Compare-mode is engaged locally in the rail. We surface the rail's
  // "Pick two explorations." copy under the phone heading block once the
  // user has clicked Compare.
  const inCompareMode =
    compareState.status === "selecting" &&
    (compareState.selectedIds.length > 0 || compareError !== null);

  return (
    <div className="px-4 py-5 lg:px-8 lg:pt-8 lg:pb-12">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Left column on lg+: the explorations rail (also used as the
            full-width list screen below lg). */}
        <AdvisorRail
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          onCreate={onCreate}
          accessToken={accessToken}
          onCompareRequest={onCompareRequest}
          onCompareError={onCompareError}
          compareSubmitting={compareSubmitting}
          creating={creating}
          atLimit={atLimit}
          disabled={compareState.status !== "selecting"}
        />

        {/* Right column on lg+: the workspace (title row + conversation + summary). */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* Phone-only list screen heading (above the rail on phone when
              there's no ?exploration= param). */}
          {!showPhoneDetail && (
            <div className="lg:hidden">
              <h1
                className="font-heading text-[26px] font-semibold leading-tight"
                style={{ color: "#2a1830" }}
              >
                Advisor
              </h1>
              <p
                className="mt-1.5 text-[14px] text-muted-foreground"
                style={{ marginTop: 6 }}
              >
                {inCompareMode
                  ? "Pick two explorations to compare."
                  : "One exploration for each direction. Each keeps its own summary."}
              </p>
            </div>
          )}

          {/* Phone-only detail screen heading + back link. */}
          {showPhoneDetail && (
            <div className="flex flex-col gap-3 lg:hidden">
              <button
                type="button"
                onClick={onClearSelection}
                className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold leading-tight text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                style={{ color: "#6e6488" }}
              >
                <ArrowLeft className="size-3.5" aria-hidden strokeWidth={2} />
                Explorations
              </button>
              {compareError && (
                <p role="alert" className="text-[13px]" style={{ color: "#b3261e" }}>
                  {compareError}
                </p>
              )}
            </div>
          )}

          {detailState.status === "loading" && (
            <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-border bg-card">
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          )}

          {detailState.status === "error" && (
            <AdvisorErrorState
              title="Could not load this exploration"
              message={detailState.message}
              onRetry={() => {
                /* re-trigger detail fetch by toggling list state */
              }}
            />
          )}

          {detailState.status === "ready" && (
            <AdvisorWorkspace
              detail={detailState.detail}
              onRefresh={onRefresh}
              onRetry={onRetry}
              onRename={onRename}
              onDelete={onDelete}
              onSubmitMessage={onSubmitMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Workspace — title row + conversation + summary.
//
// Renders the {@link AdvisorDetail} once with its default `auto` layout:
// at `xl+` it splits into the side-by-side conversation | summary grid;
// below `xl` it renders the tabs nav + only the active panel. The
// breakpoint is tracked via `matchMedia` so only ONE variant ends up
// in the DOM at any time.
// --------------------------------------------------------------------

function AdvisorWorkspace({
  detail,
  onRefresh,
  onRetry,
  onRename,
  onDelete,
  onSubmitMessage,
}: {
  detail: ExplorationDetail;
  onRefresh: () => void;
  onRetry: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onSubmitMessage: (args: {
    content?: string;
    answers: Array<{ question: string; answer: string }>;
  }) => Promise<void>;
}) {
  return (
    <AdvisorDetail
      detail={detail}
      onRefresh={onRefresh}
      onRetry={onRetry}
      onRename={onRename}
      onDelete={onDelete}
      onSubmitMessage={onSubmitMessage}
    />
  );
}