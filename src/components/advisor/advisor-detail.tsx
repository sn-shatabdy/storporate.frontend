"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/account/confirm-dialog";
import type {
  ExplorationDetail,
  ExplorationQuestion,
} from "@/lib/api/growth";
import { formatStarted } from "@/lib/growth/format-time";

import { ConversationColumn } from "@/components/advisor/advisor-conversation";
import { StatusPillForStatus } from "@/components/advisor/status-pill";
import { SummaryPanel } from "@/components/advisor/advisor-summary";

interface AdvisorDetailProps {
  detail: ExplorationDetail;
  onRefresh: () => void;
  onRetry: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onSubmitMessage: (args: {
    content?: string;
    answers: Array<{ question: string; answer: string }>;
  }) => void;
  /** Layout mode:
   *  - "auto" (default) — picks `split` at `xl+` (1280 px) and `tabs`
   *    below it, tracked via `matchMedia` so only ONE variant ends up
   *    in the DOM at any time.
   *  - "split"          — header + side-by-side conversation | summary.
   *  - "tabs"           — header + below-xl tabs (only the active panel
   *    is visible).
   *  - "conversation"   — header + conversation column only.
   *  - "summary"        — summary column only (no header).
   */
  layout?: "auto" | "split" | "tabs" | "conversation" | "summary";
}

/**
 * STOR-40 Phase 5 — the advisor page's main detail panel. Renders one
 * of four top-level shapes based on the underlying detail snapshot:
 *
 *   1. **Header** (always present) — title (renameable inline), status
 *      pill, "Started {date} · Summary version N" line, Refresh +
 *      Delete icon buttons.
 *   2. **Conversation column** (always present) — message thread
 *      (advisor / student bubbles, with the active advisor questions
 *      rendered inside the LAST advisor message's column), the working
 *      / failed tail, and a Send message form at the bottom. The
 *      conversation + composer live in
 *      `src/components/advisor/advisor-conversation.tsx`.
 *   3. **Summary column** (right side on desktop, below on phone) —
 *      either the latest summary's change-note + Gaps + Suggestions,
 *      a "No summary yet" placeholder, or an "Updating…" pill in the
 *      header while a refresh turn is in flight. The summary panel
 *      lives in `src/components/advisor/advisor-summary.tsx`.
 *   4. **Failed-turn banner** (only when `detail.status === "Failed"`)
 *      sits inside the conversation column above the input.
 */
export function AdvisorDetail({
  detail,
  onRefresh,
  onRetry,
  onRename,
  onDelete,
  onSubmitMessage,
  layout = "auto",
}: AdvisorDetailProps) {
  const isWorking = detail.status === "Working";
  const isFailed = detail.status === "Failed";

  const lastAdvisorMessage = [...detail.messages]
    .reverse()
    .find((m) => m.role === "Advisor");
  // "Active" questions = the LAST message is an Advisor message with
  // a non-empty questions array (so no Student message comes after it).
  // The conversation component uses this to decide where to render the
  // questions block (inside the last advisor message's column) and
  // whether to render the composer.
  const pendingQuestions: ExplorationQuestion[] =
    detail.messages[detail.messages.length - 1]?.role === "Advisor" &&
    lastAdvisorMessage?.id === detail.messages[detail.messages.length - 1]?.id
      ? lastAdvisorMessage.questions ?? []
      : [];

  const header = (
    <DetailHeader
      detail={detail}
      isWorking={isWorking}
      onRefresh={onRefresh}
      onRename={onRename}
      onDelete={onDelete}
    />
  );

  const conversation = (
    <ConversationColumn
      detail={detail}
      isWorking={isWorking}
      isFailed={isFailed}
      onRetry={onRetry}
      pendingQuestions={pendingQuestions}
      onSubmitMessage={onSubmitMessage}
    />
  );

  const summary = <SummaryPanel detail={detail} isWorking={isWorking} />;

  // The default ("auto") layout picks tabs below `xl` and the side-by-
  // side grid at `xl+`, tracked via `matchMedia` so only ONE variant
  // ends up in the DOM at any time. The explicit `tabs` / `split` modes
  // are kept for callers that need to force one shape (used by the
  // existing test fixtures).
  const isXl = useIsBreakpoint("(min-width: 1280px)");

  if (layout === "conversation") {
    return (
      <article className="flex flex-col gap-5">
        {header}
        {conversation}
      </article>
    );
  }

  if (layout === "summary") {
    return <article className="flex flex-col gap-5">{summary}</article>;
  }

  if (layout === "split") {
    return (
      <article className="flex flex-col gap-5">
        {header}
        <div className="grid grid-cols-[minmax(0,1fr)_392px] gap-6 items-start">
          {conversation}
          {summary}
        </div>
      </article>
    );
  }

  if (layout === "tabs") {
    return (
      <article className="flex flex-col gap-5">
        {header}
        <WorkspaceTabs conversation={conversation} summary={summary} />
      </article>
    );
  }

  // Auto: render once with the right layout for the current viewport.
  // We default to tabs (the phone layout) so a server-rendered or jsdom
  // test pass never flashes the side-by-side grid on a phone.
  if (!isXl) {
    return (
      <article className="flex flex-col gap-5">
        {header}
        <WorkspaceTabs conversation={conversation} summary={summary} />
      </article>
    );
  }

  return (
    <article className="flex flex-col gap-5">
      {header}
      <div className="grid grid-cols-[minmax(0,1fr)_392px] gap-6 items-start">
        {conversation}
        {summary}
      </div>
    </article>
  );
}

/** Subscribes to a media query and returns whether it currently matches.
 *
 *   - On SSR / Node: returns `false` (phone layout).
 *   - On the client: synchronously reads `matchMedia` so the first
 *     render already paints the correct layout — no flash of duplicate
 *     action buttons during the first effect tick.
 *   - Then subscribes to changes so resize / orientation updates the
 *     layout reactively.
 */
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

// --------------------------------------------------------------------
// Header (with inline rename + delete confirm)
// --------------------------------------------------------------------

interface DetailHeaderProps {
  detail: ExplorationDetail;
  isWorking: boolean;
  onRefresh: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

function DetailHeader({
  detail,
  isWorking,
  onRefresh,
  onRename,
  onDelete,
}: DetailHeaderProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // During the very first opening turn (Working + zero messages) the
  // design hides the Refresh / Delete pair and only the pencil stays,
  // so the student can't trash the conversation before it exists.
  const isFirstVisit = isWorking && detail.messages.length === 0;
  // The rename trigger moves from the line-1 pencil (lg+) to the
  // mobile-only icon button below the sub-line. The rename state
  // (open + draft + error) stays in `RenameableTitle` — the mobile
  // button calls `openRenameRef.current()` which dispatches the same
  // open logic that the line-1 pencil uses.
  const openRenameRef = useRef<(() => void) | null>(null);
  const triggerRename = useCallback(() => {
    openRenameRef.current?.();
  }, []);
  // Default to `false` (phone layout) during SSR so the first paint
  // never shows duplicate rename buttons.
  const isLg = useIsBreakpoint("(min-width: 1024px)");

  function handleConfirmDelete() {
    setDeleting(true);
    onDelete();
    setDeleteOpen(false);
    setTimeout(() => setDeleting(false), 600);
  }

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <RenameableTitle
          key={detail.title}
          detail={detail}
          onRename={onRename}
          registerOpenRename={(fn) => {
            openRenameRef.current = fn;
          }}
          showLinePencil={isLg}
        />
        {isLg && !isFirstVisit && (
          <div className="flex items-center gap-2">
            <HeaderRefreshButton onRefresh={onRefresh} disabled={isWorking} />
            <HeaderDeleteButton onOpen={() => setDeleteOpen(true)} />
          </div>
        )}
      </div>

      {/* Phone-only actions row, sits BELOW the sub-line per the spec.
          Renders the rename pencil as a 36×36 icon button so the inline
          line-1 pencil can stay hidden on small viewports. `min-w-0` on
          the row lets the Refresh button shrink when the rename + delete
          icon buttons consume the available width on narrow viewports
          (~500 px) without pushing the row off-screen. */}
      {!isLg && (
        <div className="flex min-w-0 items-center gap-2">
          {!isFirstVisit && (
            <HeaderRefreshButton onRefresh={onRefresh} disabled={isWorking} />
          )}
          <HeaderRenameMobile onClick={triggerRename} />
          {!isFirstVisit && (
            <HeaderDeleteButton onOpen={() => setDeleteOpen(true)} />
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete this exploration?"
        description="Its messages and summaries are removed. You cannot undo this."
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        confirmIcon={<Trash2 className="size-4" />}
        confirmLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </header>
  );
}

function HeaderRefreshButton({
  onRefresh,
  disabled,
}: {
  onRefresh: () => void;
  disabled: boolean;
}) {
  return (
    <Button
      variant="outline"
      onClick={onRefresh}
      disabled={disabled}
      className="h-9 w-auto shrink-0 justify-center rounded-[10px] px-3.5 text-sm font-semibold gap-2"
    >
      <RefreshCw className="size-4" />
      Refresh
    </Button>
  );
}

function HeaderDeleteButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      aria-label="Delete exploration"
      onClick={onOpen}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border bg-background text-[#b3261e] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      style={{ borderColor: "#e7dfc0" }}
    >
      <Trash2 className="size-4" aria-hidden strokeWidth={1.9} />
    </button>
  );
}

/** Mobile-only rename trigger. The pencil sits next to the title only at
 *  `lg+`; below `lg` the rename action lives in the actions row. The
 *  trigger dispatches a synthetic click on the line-1 pencil so the
 *  existing rename state lives in one place. */
function HeaderRenameMobile({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Rename exploration"
      onClick={onClick}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border bg-background text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      style={{ borderColor: "#e7dfc0" }}
    >
      <Pencil className="size-4" aria-hidden strokeWidth={1.9} />
    </button>
  );
}

/** Small component that owns the rename input + its local draft state.
 * The `key={detail.title}` in the parent remounts this on a successful
 * rename so the input collapses back to the static heading automatically.
 *
 * The `renameTriggerRef` is attached to the line-1 pencil button so the
 * phone-only `HeaderRenameMobile` button can dispatch a synthetic click
 * on it. This keeps the rename state in one place while letting the
 * mobile UI live elsewhere in the header tree.
 */
function RenameableTitle({
  detail,
  onRename,
  registerOpenRename,
  showLinePencil,
}: {
  detail: ExplorationDetail;
  onRename: (title: string) => void;
  registerOpenRename: (fn: () => void) => void;
  showLinePencil: boolean;
}) {
  const initialTitle = detail.title;
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(initialTitle);
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const openRename = useCallback(() => {
    setRenameDraft(initialTitle);
    setRenameError(null);
    setRenameOpen(true);
    requestAnimationFrame(() => renameInputRef.current?.focus());
  }, [initialTitle]);

  // Hand the open-rename function to the parent so the phone-only
  // HeaderRenameMobile button can trigger it (the line-1 pencil calls
  // the same function directly). Re-registered whenever `initialTitle`
  // changes so a fresh exploration title re-installs a correct closure.
  useEffect(() => {
    registerOpenRename(openRename);
    return () => registerOpenRename(() => {});
  }, [registerOpenRename, openRename, initialTitle]);

  function commitRename() {
    const next = renameDraft.trim();
    if (next.length === 0) {
      setRenameError("Give it a name.");
      return;
    }
    if (next === initialTitle) {
      setRenameOpen(false);
      setRenameError(null);
      setRenameDraft(initialTitle);
      return;
    }
    onRename(next);
    setRenameOpen(false);
    setRenameError(null);
  }

  function cancelRename() {
    setRenameOpen(false);
    setRenameError(null);
    setRenameDraft(initialTitle);
  }

  // The title-row pill is the Working or Failed pill only. Idle
  // explorations get no pill on the title row.
  const showStatusPill = detail.status === "Working" || detail.status === "Failed";

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2.5">
        {renameOpen ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameDraft}
            onChange={(e) => {
              setRenameDraft(e.target.value);
              if (renameError) setRenameError(null);
            }}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                cancelRename();
              }
            }}
            aria-label="Exploration title"
            aria-invalid={renameError ? true : undefined}
            maxLength={200}
            className="min-w-[200px] flex-1 rounded-lg border bg-background px-3 py-1.5 text-[22px] font-semibold leading-tight text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:text-2xl"
            style={{
              fontFamily: "var(--font-heading)",
              borderColor: renameError ? "#b3261e" : "var(--border)",
            }}
          />
        ) : (
          <>
            <h1
              className="font-heading text-[22px] font-semibold leading-tight text-foreground sm:text-2xl"
              style={{ color: "#2a1830" }}
            >
              {initialTitle || "Untitled exploration"}
            </h1>
            {showLinePencil && (
              <button
                type="button"
                aria-label="Rename exploration"
                onClick={openRename}
                className="inline-flex size-7 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <Pencil className="size-[15px]" aria-hidden strokeWidth={1.9} />
              </button>
            )}
          </>
        )}
        {showStatusPill && (
          <StatusPillForStatus status={detail.status} />
        )}
      </div>
      <div className="text-xs text-muted-foreground lg:text-[13px]">
        <span>{formatStarted(detail.createdAt)}</span>
        {detail.latestSummary && (
          <>
            <span aria-hidden> · </span>
            <span>Summary version {detail.latestSummary.versionNumber}</span>
          </>
        )}
      </div>
      {renameError && (
        <p role="alert" className="text-xs text-[#b3261e]">
          {renameError}
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------------------------
// Tabs (used below xl)
// --------------------------------------------------------------------

/** Two-tab nav + the currently-active panel. The tab buttons carry
 *  `role="tab"` and the active panel carries `role="tabpanel"`, with
 *  `aria-controls` + `aria-labelledby` linking them. The active tab's
 *  styling matches the approved design (semibold #2a1830 + #4d7ea0
 *  underline); inactive tabs are #6e6488 with a soft #e7dfc0 underline. */
function WorkspaceTabs({
  conversation,
  summary,
}: {
  conversation: React.ReactNode;
  summary: React.ReactNode;
}) {
  const [tab, setTab] = useState<"conversation" | "summary">("conversation");
  const conversationId = "advisor-tab-conversation";
  const summaryId = "advisor-tab-summary";

  return (
    <div className="flex flex-col gap-5">
      <nav
        aria-label="Exploration sections"
        role="tablist"
        className="flex"
      >
        <WorkspaceTabButton
          id={conversationId}
          panelId={`${conversationId}-panel`}
          active={tab === "conversation"}
          onClick={() => setTab("conversation")}
        >
          Conversation
        </WorkspaceTabButton>
        <WorkspaceTabButton
          id={summaryId}
          panelId={`${summaryId}-panel`}
          active={tab === "summary"}
          onClick={() => setTab("summary")}
        >
          Summary
        </WorkspaceTabButton>
      </nav>
      <div
        id={`${conversationId}-panel`}
        role="tabpanel"
        aria-labelledby={conversationId}
        hidden={tab !== "conversation"}
      >
        {conversation}
      </div>
      <div
        id={`${summaryId}-panel`}
        role="tabpanel"
        aria-labelledby={summaryId}
        hidden={tab !== "summary"}
      >
        {summary}
      </div>
    </div>
  );
}

function WorkspaceTabButton({
  id,
  panelId,
  active,
  onClick,
  children,
}: {
  id: string;
  panelId: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-controls={panelId}
      aria-selected={active}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={
        active
          ? "flex-1 border-b-2 py-2.5 text-center text-[14px] font-semibold leading-tight"
          : "flex-1 border-b-2 py-2.5 text-center text-[14px] font-medium leading-tight transition-colors hover:text-foreground"
      }
      style={
        active
          ? { color: "#2a1830", borderColor: "#4d7ea0" }
          : { color: "#6e6488", borderColor: "#e7dfc0" }
      }
    >
      {children}
    </button>
  );
}