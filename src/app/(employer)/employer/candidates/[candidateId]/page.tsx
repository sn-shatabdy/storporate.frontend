"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft } from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  fetchCandidateOriginal,
  getCandidate,
  type CandidateItem,
  type CandidateReview,
} from "@/lib/api/candidateReview";

import {
  CandidateHeader,
} from "@/components/talent/candidate-header";
import {
  CandidateItemCard,
  INLINE_SAFE_TYPES,
  PREVIEW_MAX_BYTES,
  openStatusForError,
  type OpenStatus,
} from "@/components/talent/candidate-item-card";
import { OriginalViewer } from "@/components/talent/original-viewer";
import {
  CandidateLoadError,
  CandidateLoadingSkeleton,
  CandidateNotFound,
} from "@/components/talent/candidate-states";

/**
 * STOR-44 Phase 4 — `/employer/candidates/{candidateId}` (the
 * employer "drill-down" review page).
 *
 * The (employer) layout owns the authorization gate; this page
 * assumes the visitor is an authenticated Organization. The page
 * is a client component (this app doesn't use server actions and
 * every existing data-fetching page uses the same useState/useEffect
 * + AbortController pattern as the search page).
 *
 * State machine for the candidate itself:
 *   - `loading`  : initial fetch in flight.
 *   - `loaded`   : GET succeeded — render the candidate header +
 *                  the items list.
 *   - `notFound` : GET returned 404 `candidate_not_found`.
 *   - `error`    : GET failed for any other reason (network, 5xx,
 *                  403). Renders a retry state.
 *
 * Open-original flow:
 *   - The page owns a single active `ViewerState` (which card's
 *     viewer is open + the blob URL + metadata). Opening any other
 *     card's original first closes the current viewer so the user
 *     never sees two viewers at once (test #11). The ObjectURL
 *     is revoked on close and on unmount.
 *   - For a non-previewable inline response (.docx, oversized, etc.)
 *     the page triggers an anchor download via a temporary link
 *     and shows a transient "Download started." status under the
 *     relevant card.
 *   - For a Link response, the page pops a synchronous blank tab
 *     to defeat popup blockers, fetches the URL, validates the
 *     scheme is http(s), then redirects the tab. On failure the
 *     tab is closed and the relevant card shows the unavailable
 *     block.
 *
 * Focus:
 *   - When the candidate loads, the section heading ("Portfolio"
 *     + "{N} items") moves focus to itself via a `tabIndex={-1}`
 *     ref so keyboard users land on the list header instead of the
 *     stale "Back to results" link.
 */
type CandidatePageState =
  | { kind: "loading" }
  | { kind: "loaded"; candidate: CandidateReview }
  | { kind: "notFound" }
  | { kind: "error" };

interface ViewerState {
  portfolioItemId: string;
  blob: Blob;
  objectUrl: string;
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
}

interface DownloadStatus {
  portfolioItemId: string;
  message: string;
  /** Set when the message was emitted so the page can auto-clear it
   *  after 3 seconds. */
  emittedAt: number;
}

export default function CandidatePage() {
  return <CandidatePageInner />;
}

function CandidatePageInner() {
  const params = useParams<{ candidateId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;
  const candidateId = params?.candidateId;

  const [state, setState] = useState<CandidatePageState>({ kind: "loading" });
  const [refreshVersion, setRefreshVersion] = useState(0);

  // Per-card open-original status: keyed by portfolioItemId. A card
  // looks up its own slot via `openStatuses[itemId] ?? { kind: "idle" }`.
  const [openStatuses, setOpenStatuses] = useState<
    Record<string, OpenStatus>
  >({});
  // Per-card transient download status (e.g. "Download started.").
  // We key by id + emittedAt so identical text on rapid re-clicks
  // still triggers a re-render.
  const [downloadStatuses, setDownloadStatuses] = useState<
    Record<string, DownloadStatus | undefined>
  >({});
  // Single active viewer. null when no card has an inline preview
  // mounted. The page passes `isActive` to each card based on
  // whether `viewerState.portfolioItemId === item.portfolioItemId`.
  const [viewerState, setViewerState] = useState<ViewerState | null>(null);

  const portfolioHeadingRef = useRef<HTMLHeadingElement>(null);

  // Per-item "Open original" button refs. The page keeps a Map of
  // item-id → ref-object so the inline viewer can return focus to
  // the right button when the user closes it.
  const openButtonRefs = useRef<
    Map<string, { current: HTMLButtonElement | null }>
  >(new Map());

  // ----------------------------------------------------------------
  // Initial candidate fetch
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!accessToken || !candidateId) return;
    const controller = new AbortController();
    const tokenAtMount = accessToken;
    const idAtMount = candidateId;
    (async () => {
      setState({ kind: "loading" });
      try {
        const review = await getCandidate(
          tokenAtMount,
          idAtMount,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setState({ kind: "loaded", candidate: review });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.errorCode === "candidate_not_found") {
          setState({ kind: "notFound" });
          return;
        }
        setState({ kind: "error" });
      }
    })();
    return () => controller.abort();
  }, [accessToken, candidateId, refreshVersion]);

  // ----------------------------------------------------------------
  // Move focus to the section heading once the candidate loads.
  // ----------------------------------------------------------------
  useEffect(() => {
    if (state.kind === "loaded") {
      // Schedule after the next paint so the heading has been
      // committed to the DOM.
      const handle = requestAnimationFrame(() => {
        portfolioHeadingRef.current?.focus();
      });
      return () => cancelAnimationFrame(handle);
    }
    return undefined;
  }, [state.kind]);

  // ----------------------------------------------------------------
  // Revoke the active viewer URL on unmount.
  // ----------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (viewerState) {
        URL.revokeObjectURL(viewerState.objectUrl);
      }
    };
  }, [viewerState]);

  // ----------------------------------------------------------------
  // Open-original handler — runs the fetch + dispatches to the
  // appropriate flow. Reads the card's current open status via
  // `openStatuses` so it can flip it back to idle on success.
  // ----------------------------------------------------------------
  const handleOpen = useCallback(
    async (item: CandidateItem) => {
      if (!accessToken || !candidateId) return;
      if (
        viewerState !== null &&
        viewerState.portfolioItemId !== item.portfolioItemId
      ) {
        // Close the previous viewer's URL before opening another.
        URL.revokeObjectURL(viewerState.objectUrl);
        setViewerState(null);
      }
      setOpenStatuses((prev) => ({
        ...prev,
        [item.portfolioItemId]: { kind: "pending" },
      }));
      try {
        const result = await fetchCandidateOriginal(
          accessToken,
          candidateId,
          item.portfolioItemId,
        );
        if (result.kind === "blob") {
          const previewable =
            result.inline &&
            result.blob.size <= PREVIEW_MAX_BYTES &&
            INLINE_SAFE_TYPES.has((result.contentType || "").toLowerCase());
          if (previewable) {
            const url = URL.createObjectURL(result.blob);
            setViewerState({
              portfolioItemId: item.portfolioItemId,
              blob: result.blob,
              objectUrl: url,
              fileName: result.fileName ?? "Original file",
              contentType: result.contentType,
              sizeBytes: result.blob.size,
            });
            setOpenStatuses((prev) => {
              const next = { ...prev };
              delete next[item.portfolioItemId];
              return next;
            });
            return;
          }
          // Trigger a download via a temporary anchor.
          triggerAnchorDownload(result.blob, result.fileName ?? "original");
          setDownloadStatuses((prev) => ({
            ...prev,
            [item.portfolioItemId]: {
              portfolioItemId: item.portfolioItemId,
              message: "Download started.",
              emittedAt: Date.now(),
            },
          }));
          setOpenStatuses((prev) => {
            const next = { ...prev };
            delete next[item.portfolioItemId];
            return next;
          });
          setTimeout(() => {
            setDownloadStatuses((prev) => {
              const current = prev[item.portfolioItemId];
              if (
                current &&
                Date.now() - current.emittedAt >= 2900
              ) {
                const next = { ...prev };
                delete next[item.portfolioItemId];
                return next;
              }
              return prev;
            });
          }, 3000);
          return;
        }
        // Link flow: open a synchronous blank tab so popup blockers
        // don't suppress the navigation, then redirect after the
        // fetch resolves.
        const tab = window.open("", "_blank");
        if (tab) {
          tab.opener = null;
        }
        try {
          const url = result.url;
          const scheme = new URL(url).protocol.toLowerCase();
          if (scheme !== "http:" && scheme !== "https:") {
            tab?.close();
            setOpenStatuses((prev) => ({
              ...prev,
              [item.portfolioItemId]: {
                kind: "error",
                title: "This original is no longer available.",
                body: "The student may have removed it.",
                retryable: false,
              },
            }));
            return;
          }
          tab!.location.href = url;
          setOpenStatuses((prev) => {
            const next = { ...prev };
            delete next[item.portfolioItemId];
            return next;
          });
        } catch {
          tab?.close();
          setOpenStatuses((prev) => ({
            ...prev,
            [item.portfolioItemId]: {
              kind: "error",
              title: "This original is no longer available.",
              body: "The student may have removed it.",
              retryable: false,
            },
          }));
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setOpenStatuses((prev) => ({
          ...prev,
          [item.portfolioItemId]: openStatusForError(error),
        }));
      }
    },
    [accessToken, candidateId, viewerState],
  );

  const handleCloseViewer = useCallback(() => {
    if (viewerState !== null) {
      URL.revokeObjectURL(viewerState.objectUrl);
    }
    setViewerState(null);
  }, [viewerState]);

  // Per-item id → ref-object for the card's "Open original" button.
  // Returned refs share identity across renders within an item so the
  // card's `ref={openButtonRef}` and the viewer's `restoreFocusRef`
  // always point at the same DOM node.
  function getOrCreateOpenButtonRef(
    portfolioItemId: string,
  ): { current: HTMLButtonElement | null } {
    let ref = openButtonRefs.current.get(portfolioItemId);
    if (!ref) {
      ref = { current: null };
      openButtonRefs.current.set(portfolioItemId, ref);
    }
    return ref;
  }

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  if (state.kind === "loading") {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-7">
          <BackLink onClick={() => router.back()} />
          <CandidateLoadingSkeleton />
        </div>
      </div>
    );
  }

  if (state.kind === "notFound") {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-7">
          <BackLink onClick={() => router.back()} />
          <CandidateNotFound />
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-7">
          <BackLink onClick={() => router.back()} />
          <CandidateLoadError onRetry={() => setRefreshVersion((v) => v + 1)} />
        </div>
      </div>
    );
  }

  const { candidate } = state;
  const itemCount = candidate.items.length;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-7">
        <BackLink onClick={() => router.back()} />
        <CandidateHeader candidate={candidate} />

        <div className="flex items-baseline justify-between">
          <h2
            ref={portfolioHeadingRef}
            tabIndex={-1}
            className="font-heading text-xl font-semibold text-foreground focus:outline-none"
          >
            Portfolio
          </h2>
          <p className="text-xs font-medium text-muted-foreground">
            {itemCount === 1 ? "1 item" : `${itemCount} items`}
          </p>
        </div>

        <ol className="flex flex-col gap-5" data-testid="candidate-items">
          {candidate.items.map((item) => {
            const openStatus =
              openStatuses[item.portfolioItemId] ?? { kind: "idle" };
            const downloadStatus =
              downloadStatuses[item.portfolioItemId]?.message ?? null;
            const isActive =
              viewerState !== null &&
              viewerState.portfolioItemId === item.portfolioItemId;
            const handleClick = () => {
              void handleOpen(item);
            };
            return (
              <div key={item.portfolioItemId} className="flex flex-col">
                <CandidateItemCard
                  item={item}
                  candidateId={candidate.candidateId}
                  bearerToken={accessToken ?? ""}
                  openStatus={openStatus}
                  onOpen={handleClick}
                  downloadStatus={downloadStatus}
                  openButtonRef={getOrCreateOpenButtonRef(
                    item.portfolioItemId,
                  )}
                />
                {isActive && viewerState && (
                  <OriginalViewer
                    fileName={viewerState.fileName}
                    contentType={viewerState.contentType}
                    sizeBytes={viewerState.sizeBytes}
                    objectUrl={viewerState.objectUrl}
                    onClose={handleCloseViewer}
                    onDownload={() => {
                      triggerAnchorDownload(
                        viewerState.blob,
                        viewerState.fileName,
                      );
                    }}
                    restoreFocusRef={getOrCreateOpenButtonRef(
                      item.portfolioItemId,
                    )}
                  />
                )}
              </div>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  // Use router.back() when there's history (per the design), else
  // fall back to a regular link. JSDOM + jsdom-history makes
  // `window.history.length > 1` unreliable in tests, so we always
  // render the visible link and call back() in the click handler.
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-primary"
      data-testid="back-to-results"
    >
      <ChevronLeft className="size-3.5" aria-hidden />
      Back to results
    </button>
  );
}

/**
 * Click a hidden anchor with `download={fileName}` to trigger the
 * browser's download flow. Created via `URL.createObjectURL` so
 * the anchor's href can be revoked synchronously after the click.
 */
function triggerAnchorDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revocation so the browser has time to start the download
  // (some browsers cancel the download if the URL is revoked too
  // soon — the `setTimeout(..., 0)` gives the click handler a
  // chance to fire).
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
