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

/** How long to wait between list polls while ANY item is `Working`.
 * 4 s matches the cadence the portfolio detail page already uses, so
 * working-state feedback feels uniform across the dashboard. */
const LIST_POLL_INTERVAL_MS = 4000;

/** URL parameter that drives the selected exploration (per Next.js
 * `useSearchParams`). The URL is the single source of truth — the page
 * derives `selectedId` from the param on every render and writes it back
 * via `router.replace` only on user-initiated selection changes. */
const EXPLORATION_PARAM = "exploration";

type ListState =
  | { status: "loading" }
  | { status: "ready"; items: ExplorationListItem[] }
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
 * focused on data flow + transitions.
 *
 * URL-as-source-of-truth for selection:
 *   - The `?exploration=<id>` URL parameter is the only thing that
 *     names the selected exploration.
 *   - `selectedId` is DERIVED from the URL (with one lg-only fallback
 *     to the first item when the param is missing or unknown) and is
 *     NEVER stored in component state.
 *   - `select(id)` only calls `router.replace(path?exploration=id, { scroll: false })`.
 *   - `router.replace` is the ONLY writer of the URL — no `useEffect`
 *     bridges the URL and selection, so the two never fight.
 *
 * First-visit auto-start:
 *   - When the FIRST list response of this page load resolves as
 *     `items.length === 0`, fire `createExploration()` exactly once
 *     (guarded by a ref so React StrictMode's double-effect can't fire
 *     twice). The first response sets `firstListResolvedRef.current`,
 *     so subsequent empty responses (after a delete) never re-trigger
 *     the auto-create.
 *
 * Rail freshness (A4):
 *   - Refetch the list every time the selected exploration's status
 *     transitions from `Working` to `Idle` or `Failed` (one terminal
 *     refetch per exploration id).
 *   - Refetch on rename + create.
 *   - While ANY list item is `Working`, poll the list every 4000 ms
 *     with a fresh AbortController per tick (derived `anyWorking`,
 *     stops when none is Working).
 *
 * Phone layout (A2):
 *   - Below lg: list screen renders ONLY the heading + rail block; the
 *     detail is hidden entirely. With a valid param, the detail screen
 *     renders ONLY the back link + title + tabs + active panel; the
 *     rail is hidden entirely. The two screens are mutually exclusive.
 *   - Refresh button is `w-auto` (not full width) below lg, alongside
 *     36x36 rename + 36x36 delete icon buttons in a `flex gap-2` row.
 */
export default function AdvisorPageRoute() {
  return (
    <Suspense fallback={null}>
      <AdvisorPageShell />
    </Suspense>
  );
}

function useIsBreakpoint(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
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
  // (create / delete / rename / refresh / status terminal).
  const [listVersion, setListVersion] = useState(0);

  // First-list-resolved guard (A3). The first list response sets this
  // ref regardless of whether the list was empty or populated. A
  // subsequent empty list (after a delete) NEVER auto-creates a new
  // exploration; the "No explorations yet" card renders instead.
  const firstListResolvedRef = useRef(false);
  // Auto-create-fired guard — survives React StrictMode's double-effect
  // mount so the auto-create POST never fires twice on the first visit.
  const autoCreateFiredRef = useRef(false);
  const [firstListResolved, setFirstListResolved] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);

  // Derived flag for the auto-create effect's deps list. Booleans are
  // safe in deps arrays; reading `listState.items.length` directly
  // would throw when status is "loading" (no `items` field). We
  // surface the boolean instead of the length so the dep array can
  // safely read it before the early-return guard runs.
  const autoCreateItemsIsEmpty =
    listState.status === "ready" && listState.items.length === 0;

  // ------------------------------------------------------------------
  // Derived selection. The URL is the source of truth.
  // ------------------------------------------------------------------
  const items = listState.status === "ready" ? listState.items : [];
  const isLg = useIsBreakpoint("(min-width: 1024px)");
  const urlParam = searchParams?.get(EXPLORATION_PARAM) ?? null;
  // On lg and up, a missing or unknown param falls back to the first
  // item so the page always shows a selected exploration. Below lg,
  // missing/unknown means the list screen, so the derived id stays null.
  const urlMatchesItem = urlParam != null && items.some((it) => it.id === urlParam);
  const fallbackId = isLg ? items[0]?.id ?? null : null;
  const selectedId = urlMatchesItem ? urlParam : fallbackId;

  // ------------------------------------------------------------------
  // List fetch
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    const tokenAtMount = accessToken;
    const isFirstCall = !firstListResolvedRef.current;

    (async () => {
      try {
        const next = await listExplorations(tokenAtMount, controller.signal);
        if (controller.signal.aborted) return;
        if (isFirstCall) {
          firstListResolvedRef.current = true;
          setFirstListResolved(true);
        }
        setListState({ status: "ready", items: next });
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
  // First-visit auto-create: when the FIRST list response of this page
  // load is empty AND the auto-create hasn't fired yet, spin up a
  // single `createExploration()`. The `firstListResolved` flag is set
  // on the first list response (empty or not), so a later empty list
  // never re-triggers the create.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!accessToken) return;
    if (!firstListResolved) return;
    if (!autoCreateItemsIsEmpty) return;
    // Auto-create ref prevents React StrictMode's double-effect mount
    // from firing twice.
    if (autoCreateFiredRef.current) return;
    autoCreateFiredRef.current = true;
    setAutoCreating(true);

    (async () => {
      try {
        const { id } = await createExploration(accessToken);
        if (!id) return;
        // Optimistically add the new exploration so the first-visit
        // detail view appears immediately; the list refetch will
        // reconcile the row's title + status on the next tick.
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
              }
            : prev,
        );
        // Surface the new exploration via the URL so the detail
        // fetcher picks it up.
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        params.set(EXPLORATION_PARAM, id);
        const qs = params.toString();
        const path = qs.length > 0
          ? `${window.location.pathname}?${qs}`
          : window.location.pathname;
        router.replace(path, { scroll: false });
      } catch (error) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, firstListResolved, autoCreateItemsIsEmpty]);

  // ------------------------------------------------------------------
  // Detail fetch — driven by the derived selectedId. Below lg with no
  // valid param, the selectedId is null and the detail stays at
  // `status: "none"` (the list screen renders instead).
  // ------------------------------------------------------------------
  useEffect(() => {
    const idAtMount = selectedId;
    const tokenAtMount = accessToken;

    // The "no selection" state is the empty/null screen — no fetch.
    // We flip to it asynchronously inside the IIFE so the lint rule
    // `react-hooks/set-state-in-effect` (cascading-render guard) doesn't
    // fire; the IIFE's microtask breaks the synchronous setState cycle.
    if (!idAtMount || !tokenAtMount) {
      Promise.resolve().then(() => {
        setDetailState({ status: "none" });
      });
      return;
    }

    const controller = new AbortController();

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
  // Detail polling: when the SELECTED detail is `Working`, poll it on
  // the 4s interval. Refetch the list once on each terminal transition
  // (Idle/Failed) so the rail row catches up. Other rows' status flips
  // are handled by the list-poll below (anyWorking).
  // ------------------------------------------------------------------
  const currentDetail =
    detailState.status === "ready" ? detailState.detail : null;

  const pollingId = detailState.status === "ready" ? detailState.detail.id : null;
  const pollingStatus =
    detailState.status === "ready" ? detailState.detail.status : null;
  const shouldPollDetail = pollingStatus === "Working";

  useEffect(() => {
    if (!accessToken || !pollingId || !shouldPollDetail) return;

    let cancelled = false;
    let currentController: AbortController | null = null;

    const interval = setInterval(() => {
      if (currentController) currentController.abort();
      currentController = new AbortController();
      const signal = currentController.signal;
      const tokenAtTick = accessToken;
      const idAtTick = pollingId;

      (async () => {
        try {
          const next = await getExploration(idAtTick, tokenAtTick, signal);
          if (cancelled || signal.aborted) return;
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
    }, LIST_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (currentController) currentController.abort();
    };
  }, [accessToken, pollingId, shouldPollDetail]);

  // Refetch the list every time the SELECTED exploration's status
  // transitions to a terminal state (Idle or Failed). The ref is keyed
  // on the exploration id: once we refetch on this id's first terminal
  // flip, we skip further refetches until the id goes back to Working
  // (e.g. a `Working → Idle → Failed` chain on the same id only refetches
  // once — the first `Idle` — because the ref still matches; a fresh
  // turn (`Idle → Working → Idle`) refetches again because the Working
  // tick resets the ref).
  const hasRefreshedListOnTerminalRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentDetail) return;
    if (currentDetail.status === "Working") {
      // Reset the ref when we go back to Working so the NEXT terminal
      // transition can refetch again.
      if (hasRefreshedListOnTerminalRef.current === currentDetail.id) {
        hasRefreshedListOnTerminalRef.current = null;
      }
      return;
    }
    if (hasRefreshedListOnTerminalRef.current === currentDetail.id) return;
    hasRefreshedListOnTerminalRef.current = currentDetail.id;
    setListVersion((v) => v + 1);
  }, [currentDetail]);

  // ------------------------------------------------------------------
  // List poll: while ANY item is `Working`, refetch the list on the 4s
  // interval. One AbortController per tick; the interval clears the
  // moment `anyWorking` flips to false.
  // ------------------------------------------------------------------
  const anyWorking = items.some((it) => it.status === "Working");
  useEffect(() => {
    if (!accessToken || !anyWorking) return;

    let cancelled = false;
    let currentController: AbortController | null = null;

    const interval = setInterval(() => {
      if (currentController) currentController.abort();
      currentController = new AbortController();
      const signal = currentController.signal;
      const tokenAtTick = accessToken;

      (async () => {
        try {
          const next = await listExplorations(tokenAtTick, signal);
          if (cancelled || signal.aborted) return;
          setListState({ status: "ready", items: next });
        } catch {
          // Swallow aborts + transient errors; the next tick will retry.
        }
      })();
    }, LIST_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (currentController) currentController.abort();
    };
  }, [accessToken, anyWorking]);

  // ------------------------------------------------------------------
  // Mutations
  // ------------------------------------------------------------------
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!accessToken || creating) return;
    setCreating(true);
    try {
      const { id } = await createExploration(accessToken);
      // Bump the list version so the rail row appears immediately, then
      // route to the new exploration so the detail fetcher picks it up.
      setListVersion((v) => v + 1);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set(EXPLORATION_PARAM, id);
      const qs = params.toString();
      const path = qs.length > 0
        ? `${window.location.pathname}?${qs}`
        : window.location.pathname;
      router.replace(path, { scroll: false });
    } catch {
      setListState({
        status: "error",
        message: "Could not create your exploration.",
      });
    } finally {
      setCreating(false);
    }
  }, [accessToken, creating, router, searchParams]);

  // The rail's `select` callback — drives ONLY the URL. No state write.
  const handleSelect = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set(EXPLORATION_PARAM, id);
      const qs = params.toString();
      const path = qs.length > 0
        ? `${window.location.pathname}?${qs}`
        : window.location.pathname;
      router.replace(path, { scroll: false });
    },
    [router, searchParams],
  );

  const handleClearSelection = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete(EXPLORATION_PARAM);
    const qs = params.toString();
    const path = qs.length > 0
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    router.replace(path, { scroll: false });
  }, [router, searchParams]);

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
        // Re-throw so the inline alert on the composer / answers form
        // can surface a friendly retry. We intentionally do NOT flip
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
        // Refresh the rail so the new title appears immediately.
        setListVersion((v) => v + 1);
      } catch {
        // Ignore; the title input stays open so the user can retry.
      }
    },
    [accessToken, currentDetail],
  );

  const handleDelete = useCallback(async () => {
    if (!accessToken || !currentDetail) return;
    const deletedId = currentDetail.id;
    try {
      await deleteExploration(deletedId, accessToken);
      setDetailState({ status: "none" });
      // Remove the deleted id from the URL. If items still remain
      // (after the upcoming refetch settles), the lg-only fallback in
      // `selectedId` will land on the new first item. Below lg, clear
      // the param so the list screen renders.
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.delete(EXPLORATION_PARAM);
      const qs = params.toString();
      const path = qs.length > 0
        ? `${window.location.pathname}?${qs}`
        : window.location.pathname;
      router.replace(path, { scroll: false });
      setListVersion((v) => v + 1);
    } catch {
      // Ignore — the dialog stays open so the user can retry.
    }
  }, [accessToken, currentDetail, router, searchParams]);

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
        list={items}
        accessToken={accessToken ?? ""}
        onCancel={handleCancelCompare}
        onRetry={handleCompareRetry}
        onCompareStateChange={setCompareState}
      />
    );
  }

  // "No explorations yet" — only shown after the first-list response
  // resolved AND the auto-create attempt is done so a first-visit
  // doesn't briefly flash an empty state before the create call
  // resolves. The "first response empty" path is handled by the
  // auto-create effect above; this branch fires for the
  // "first response non-empty, then delete-the-last-one" case.
  if (items.length === 0 && firstListResolved && !creating) {
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

  const atLimit = items.length >= MAX_EXPLORATIONS_PER_STUDENT;

  return (
    <AdvisorShell
      items={items}
      selectedId={selectedId}
      detailState={detailState}
      compareState={compareState}
      compareError={compareError}
      atLimit={atLimit}
      isLg={isLg}
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
// (driven by the URL param) — never both at once.
// --------------------------------------------------------------------

interface AdvisorShellProps {
  items: ExplorationListItem[];
  selectedId: string | null;
  detailState: DetailState;
  compareState: CompareState;
  compareError: string | null;
  atLimit: boolean;
  isLg: boolean;
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
  isLg,
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
  // The selectedId is the URL-derived one — when it matches an item,
  // we're on the detail screen; when it doesn't (or is null below lg),
  // we're on the list screen. The two screens are mutually exclusive.
  const showPhoneDetail = selectedId != null;

  // Compare-mode is engaged locally in the rail. We surface the rail's
  // "Pick two explorations." copy under the phone heading block once the
  // user has clicked Compare.
  const inCompareMode =
    compareState.status === "selecting" &&
    (compareState.selectedIds.length > 0 || compareError !== null);

  return (
    <div className="px-4 py-5 lg:px-8 lg:pt-8 lg:pb-12">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 lg:grid lg:grid-cols-[272px_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* Phone-only list screen heading. Rendered ABOVE the rail on
            the list screen below lg (where the rail is the only thing
            the user sees); hidden everywhere else because the rail at
            lg+ carries its own header, and the phone detail screen has
            its own back-link heading. */}
        {!showPhoneDetail && !isLg && (
          <div className="lg:hidden">
            <h1
              className="font-heading text-[26px] font-semibold leading-tight text-foreground"
              style={{ color: "#2a1830" }}
            >
              Advisor
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {inCompareMode
                ? "Pick two explorations to compare."
                : "One exploration for each direction. Each keeps its own summary."}
            </p>
          </div>
        )}

        {/* Below lg, hide the rail entirely when the user is on the
            detail screen. Above lg, the rail is always visible. */}
        {(!showPhoneDetail || isLg) && (
          <AdvisorRail
            items={items}
            selectedId={selectedId}
            onSelect={onSelect}
            onCreate={onCreate}
            accessToken={accessToken}
            onCompareRequest={onCompareRequest}
            onCompareError={onCompareError}
            compareErrorMessage={compareError}
            compareSubmitting={false}
            creating={creating}
            atLimit={atLimit}
            disabled={compareState.status !== "selecting"}
          />
        )}

        {/* Below lg, hide the workspace entirely when the user is on the
            list screen. Above lg, the workspace is always visible. */}
        {(showPhoneDetail || isLg) && (
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {/* Phone-only detail screen heading + back link. */}
            {showPhoneDetail && !isLg && (
              <div className="flex flex-col gap-3 lg:hidden">
                <button
                  type="button"
                  onClick={onClearSelection}
                  className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold leading-tight text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  style={{ color: "#6e6488" }}
                >
                  <ArrowLeft
                    className="size-3.5"
                    aria-hidden
                    strokeWidth={2}
                  />
                  Explorations
                </button>
                {compareError && (
                  <p
                    role="alert"
                    className="text-[13px]"
                    style={{ color: "#b3261e" }}
                  >
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
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Workspace — title row + conversation + summary.
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
