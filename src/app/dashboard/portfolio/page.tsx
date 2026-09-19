"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FileText,
  Inbox,
  Link2,
  Loader2,
  OctagonAlert,
  Trash2,
  Upload,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import {
  ALLOWED_PORTFOLIO_FILE_CONTENT_TYPES,
  MAX_PORTFOLIO_FILE_SIZE_BYTES,
  PORTFOLIO_CATEGORIES,
  PORTFOLIO_OTHER_CATEGORY,
  deletePortfolioItem,
  listPortfolioItems,
  uploadPortfolioItem,
  type PortfolioItem,
} from "@/lib/api/portfolio";
import {
  styleForAnalysisStatus,
  styleForConfidenceBand,
  type AnalysisStatus,
  type ConfidenceBand,
} from "@/lib/portfolio/analysis-status";
import { cn } from "cn";

const PAGE_SIZE = 100;

/** How many condensed skill pills to show inline per timeline entry before
 * collapsing the rest into a `+N more` pill. Approved on the design canvas
 * as the right "read-it-at-a-glance" density for the timeline — fewer than
 * the detail page's full skill list, more than zero. */
const VISIBLE_SKILL_BADGES = 3;

/** Map of the wire `category` value to the human-readable label shown in the
 * list. Mirrors `PORTFOLIO_CATEGORIES` but indexed by `value` so the list
 * lookup stays O(1). Built once at module load. */
const CATEGORY_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(
  PORTFOLIO_CATEGORIES.map((c) => [c.value, c.label]),
);

/** Which submission tab is currently active — keeps label/category/etc.
 * persisted across tab switches, just resets the file/url picker and the
 * inline error message (per the approved design). */
type SubmissionTab = "file" | "link";

type ListState =
  | { status: "loading" }
  | { status: "success"; items: PortfolioItem[]; totalCount: number }
  | { status: "error"; message: string };

/** Display string for a portfolio item — turns a `PortfolioItemResponse` into
 * a short, human-readable secondary line for the list row. Shows the file's
 * original filename (and size) for file submissions, or the URL host for
 * link submissions, falling back to the description or a generic label. */
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

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Example: "Sep 14, 2026" — short, locale-aware, no time-of-day (we don't
  // currently display the time anywhere in the list and the date alone is
  // what a student is most likely to scan by).
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Header-summary right-hand copy. Pluralizes both counts and only mentions
 * skills when at least one was identified across the loaded items. */
function summaryLine(itemCount: number, skillCount: number): string {
  const itemPart = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  if (skillCount <= 0) return itemPart;
  return `${itemPart} · ${skillCount} ${skillCount === 1 ? "skill identified" : "skills identified"}`;
}

/** Per-error-code user-facing message. Kept short and concrete so the
 * student understands what to fix without having to guess from the wire
 * code. Unknown error codes fall back to the `ApiError`'s `message` field
 * (which is whatever the backend's `GlobalExceptionHandler` produced). */
function messageForError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Something went wrong.";
  }
  switch (error.errorCode) {
    case "label_required":
      return "Add a label so this item is easy to find later.";
    case "label_too_long":
      return "Label must be 200 characters or fewer.";
    case "category_required":
      return "Pick a category.";
    case "category_unrecognized":
      return "That category isn't recognized. Pick one from the list.";
    case "custom_category_text_required":
      return "Describe the category when you pick \"Other\".";
    case "submission_source_conflict":
      return "Add either a file or a link — not both.";
    case "file_too_large":
      return "File is over 100MB. Pick a smaller file.";
    case "file_content_type_not_allowed":
      return "That file type isn't supported.";
    case "external_url_required":
      return "Paste a URL.";
    case "external_url_invalid":
      return "That URL doesn't look right. Use a full http:// or https:// link.";
    default:
      return error.message;
  }
}

export default function PortfolioPage() {
  const { data: session, status } = useSession();
  const accessToken = session?.accessToken;

  // Form state — `label`/`category`/`customCategoryText` are intentionally
  // shared across both tabs so switching tabs mid-fill doesn't lose typed
  // input. Per the design: switching tabs clears the picker AND the error
  // message but keeps these three.
  const [tab, setTab] = useState<SubmissionTab>("file");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [customCategoryText, setCustomCategoryText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Bump-on-mutation version counter so the list effect re-runs after submit
  // and delete without us needing to depend on `state.items` (which would
  // loop because the effect also writes to it).
  const [listVersion, setListVersion] = useState(0);

  const [listState, setListState] = useState<ListState>({ status: "loading" });

  // Holds the id of an item mid-delete, so its row can render a spinner
  // instead of the trash button without disabling the whole list.
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    // Capture the token at mount so a session refresh mid-fetch can't swap
    // the bearer header out from under the in-flight request. The version
    // bump is the deliberate refresh trigger; `listVersion` is already in
    // the dep array so the effect re-runs on every bump.
    const tokenAtMount = accessToken;

    // Inline async IIFE — same pattern as `account/page.tsx` and the root
    // diagnostics page. Avoids the `react-hooks/set-state-in-effect` lint
    // rule that fires when an extracted `async` function calls `setState`
    // directly: by awaiting inside the IIFE the rule's "setState inside
    // effect body" check sees only the (gated) `await` and not a
    // synchronous `setState` call.
    (async () => {
      setListState({ status: "loading" });
      try {
        const result = await listPortfolioItems(1, PAGE_SIZE, tokenAtMount, controller.signal);
        if (controller.signal.aborted) return;
        setListState({
          status: "success",
          items: result.items,
          totalCount: result.totalCount,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setListState({
          status: "error",
          message: messageForError(error),
        });
      }
    })();

    return () => controller.abort();
  }, [accessToken, listVersion]);

  function resetForm() {
    setLabel("");
    setCategory("");
    setCustomCategoryText("");
    setFile(null);
    setExternalUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function switchTab(next: SubmissionTab) {
    setTab(next);
    setSubmitError(null);
    // Tab-specific inputs reset on tab change (the file picker / URL field
    // are tab-specific by design) but the shared fields (label/category)
    // stay so a student flipping back doesn't lose typing.
    setFile(null);
    setExternalUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleCategoryChange(value: string) {
    setCategory(value);
    if (value !== PORTFOLIO_OTHER_CATEGORY) {
      setCustomCategoryText("");
    }
  }

  /** Pure client-side validation matching the backend's validator rules.
   * Returns the first user-facing message it finds, or `null` if the form
   * is acceptable. Avoids round-tripping requests the server will reject. */
  function validate(): string | null {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return messageForError(new ApiError("label_required", "", 400));
    if (trimmedLabel.length > 200) return messageForError(new ApiError("label_too_long", "", 400));
    if (!category) return messageForError(new ApiError("category_required", "", 400));
    if (category === PORTFOLIO_OTHER_CATEGORY && !customCategoryText.trim()) {
      return messageForError(new ApiError("custom_category_text_required", "", 400));
    }
    if (tab === "file") {
      if (!file) return "Choose a file to upload.";
      if (file.size > MAX_PORTFOLIO_FILE_SIZE_BYTES) {
        return messageForError(new ApiError("file_too_large", "", 400));
      }
      if (!ALLOWED_PORTFOLIO_FILE_CONTENT_TYPES.has(file.type)) {
        return messageForError(new ApiError("file_content_type_not_allowed", "", 400));
      }
    } else {
      const trimmedUrl = externalUrl.trim();
      if (!trimmedUrl) return messageForError(new ApiError("external_url_required", "", 400));
      let parsed: URL;
      try {
        parsed = new URL(trimmedUrl);
      } catch {
        return messageForError(new ApiError("external_url_invalid", "", 400));
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return messageForError(new ApiError("external_url_invalid", "", 400));
      }
    }
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }
    if (!accessToken) return;

    setSubmitting(true);
    try {
      await uploadPortfolioItem(
        {
          label: label.trim(),
          category,
          customCategoryText: customCategoryText.trim() || undefined,
          file: tab === "file" ? file ?? undefined : undefined,
          externalUrl: tab === "link" ? externalUrl.trim() : undefined,
        },
        accessToken,
      );
      resetForm();
      setListVersion((v) => v + 1);
    } catch (error) {
      setSubmitError(messageForError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!accessToken) return;
    setSubmitError(null);
    setDeletingId(id);
    // Optimistically drop the row from the visible list so the UI feels
    // instant — if the delete fails we restore it and surface the error.
    let priorItems: PortfolioItem[] | null = null;
    let priorCount: number | null = null;
    setListState((prev) => {
      if (prev.status !== "success") return prev;
      priorItems = prev.items;
      priorCount = prev.totalCount;
      return {
        status: "success",
        items: prev.items.filter((item) => item.id !== id),
        totalCount: Math.max(0, prev.totalCount - 1),
      };
    });
    try {
      await deletePortfolioItem(id, accessToken);
    } catch (error) {
      if (priorItems && priorCount !== null) {
        setListState({
          status: "success",
          items: priorItems,
          totalCount: priorCount,
        });
      }
      setSubmitError(messageForError(error));
    } finally {
      setDeletingId(null);
    }
  }

  if (status === "loading" || !session) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading your portfolio…</p>
      </div>
    );
  }

  const showCustomCategory = category === PORTFOLIO_OTHER_CATEGORY;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-8">
        <header>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            My Portfolio
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Add a file, a certificate, a dataset, or a link to something you built. There&apos;s no fixed list of approved platforms.
          </p>
        </header>

        <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div role="tablist" aria-label="Submission type" className="inline-flex w-fit rounded-lg border bg-muted/40 p-1">
            <TabButton
              active={tab === "file"}
              onClick={() => switchTab("file")}
              icon={<Upload className="size-4" />}
            >
              Upload a file
            </TabButton>
            <TabButton
              active={tab === "link"}
              onClick={() => switchTab("link")}
              icon={<Link2 className="size-4" />}
            >
              Paste a link
            </TabButton>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            {tab === "file" ? (
              <FilePicker
                file={file}
                onChange={(next) => {
                  setFile(next);
                  setSubmitError(null);
                }}
                inputRef={fileInputRef}
              />
            ) : (
              <LinkField
                value={externalUrl}
                onChange={(next) => {
                  setExternalUrl(next);
                  setSubmitError(null);
                }}
              />
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Label" htmlFor="portfolio-label">
                <input
                  id="portfolio-label"
                  type="text"
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    setSubmitError(null);
                  }}
                  placeholder="e.g. Final-year thesis"
                  maxLength={200}
                  className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </Field>
              <Field label="Category" htmlFor="portfolio-category">
                <select
                  id="portfolio-category"
                  value={category}
                  onChange={(e) => {
                    handleCategoryChange(e.target.value);
                    setSubmitError(null);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <option value="">Choose a category…</option>
                  {PORTFOLIO_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {showCustomCategory && (
              <Field label="Describe the category" htmlFor="portfolio-custom-category">
                <input
                  id="portfolio-custom-category"
                  type="text"
                  value={customCategoryText}
                  onChange={(e) => {
                    setCustomCategoryText(e.target.value);
                    setSubmitError(null);
                  }}
                  placeholder="e.g. Community organizing record"
                  maxLength={200}
                  className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                />
              </Field>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
              {submitError && (
                <p
                  role="alert"
                  aria-label="Submission error"
                  className="max-w-full break-words text-sm text-destructive [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] [overflow:hidden]"
                >
                  {submitError}
                </p>
              )}
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Add to portfolio
              </Button>
            </div>
          </form>
        </section>

        <TimelineSection
          listState={listState}
          deletingId={deletingId}
          onDelete={handleDelete}
          onRetry={() => setListVersion((v) => v + 1)}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline section (post-form) — rebuilt to match the approved design canvas.
// ---------------------------------------------------------------------------

interface TimelineSectionProps {
  listState: ListState;
  deletingId: string | null;
  onDelete: (id: string) => void;
  onRetry: () => void;
}

function TimelineSection({ listState, deletingId, onDelete, onRetry }: TimelineSectionProps) {
  // Summary only appears in the populated state (approved design).
  const summary =
    listState.status === "success" && listState.items.length > 0
      ? summaryLine(
          listState.items.length,
          listState.items.reduce((sum, item) => sum + item.skills.length, 0),
        )
      : null;

  return (
    <section className="flex flex-col gap-7">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Your portfolio
          </h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Every item you&apos;ve submitted, newest first — click through to see what the AI found.
          </p>
        </div>
        {summary !== null && (
          <span className="whitespace-nowrap text-xs font-medium text-muted-foreground">
            {summary}
          </span>
        )}
      </div>

      {listState.status === "loading" && <PortfolioListSkeleton />}

      {listState.status === "success" && listState.items.length === 0 && (
        <PortfolioEmptyState />
      )}

      {listState.status === "success" && listState.items.length > 0 && (
        <TimelineList items={listState.items} deletingId={deletingId} onDelete={onDelete} />
      )}

      {listState.status === "error" && (
        <PortfolioErrorState message={listState.message} onRetry={onRetry} />
      )}
    </section>
  );
}

interface TimelineListProps {
  items: PortfolioItem[];
  deletingId: string | null;
  onDelete: (id: string) => void;
}

function TimelineList({ items, deletingId, onDelete }: TimelineListProps) {
  return (
    <ol
      role="list"
      aria-label="Portfolio timeline"
      className="relative flex flex-col gap-5 sm:gap-7"
    >
      <TimelineSpine variant="solid" />
      {items.map((item) => (
        <PortfolioRow
          key={item.id}
          item={item}
          deleting={deletingId === item.id}
          onDelete={() => onDelete(item.id)}
        />
      ))}
    </ol>
  );
}

/** Solid 2px spine used by the populated + loading states. Always visible —
 * the design keeps the rail at every breakpoint (the dot gets smaller on
 * phone but the spine stays). Positioned so a 14px dot centered in the 32px
 * rail column sits exactly over it. */
function TimelineSpine({ variant }: { variant: "solid" | "dashed" }) {
  const dashedStyle: React.CSSProperties = {
    backgroundImage:
      "repeating-linear-gradient(to bottom, var(--border) 0 6px, transparent 6px 12px)",
    backgroundColor: "transparent",
  };
  const solidStyle: React.CSSProperties = {
    backgroundColor: "var(--border)",
  };

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute"
      style={{
        left: 15,
        top: 8,
        bottom: 8,
        width: 2,
        ...(variant === "dashed" ? dashedStyle : solidStyle),
      }}
    />
  );
}

interface PortfolioRowProps {
  item: PortfolioItem;
  deleting: boolean;
  onDelete: () => void;
}

/** Single timeline row. Same DOM at every breakpoint; sizing and reorder via
 * `sm:` variants. Exactly one dot, one delete button, one date — keeps both
 * the live keyboard focus order and the test selectors unambiguous. The
 * card is a 2-column CSS grid: the icon owns column 1 on desktop and stacks
 * to the left of the title on mobile; the title/pills/meta cells are laid
 * out via `grid-template-areas` so we can relocate the meta cell (date +
 * delete) between mobile (last row, top-bordered footer) and desktop
 * (top-right of the title row) without duplicating any DOM. */
function PortfolioRow({ item, deleting, onDelete }: PortfolioRowProps) {
  const categoryLabel = CATEGORY_LABEL_BY_VALUE[item.category] ?? item.category;
  const statusStyle = styleForAnalysisStatus(item.analysisStatus as AnalysisStatus);
  const StatusIcon = statusStyle.icon;
  const isAnalyzing = item.analysisStatus === "Analyzing";
  const dotFill = statusStyle.color;
  const showSkills = item.analysisStatus === "Analyzed" && item.skills.length > 0;
  const visibleSkills = item.skills.slice(0, VISIBLE_SKILL_BADGES);
  const overflowCount = item.skills.length - visibleSkills.length;

  const formattedDate = formatCreatedAt(item.createdAt);
  const SubmissionIcon = item.submissionType === "File" ? FileText : Link2;

  return (
    <li className="relative grid grid-cols-[24px_1fr] items-start gap-3 sm:grid-cols-[32px_1fr] sm:gap-5">
      {/* Left rail — the timeline dot. Single full circle for every row;
       * page-background ring makes the spine appear to pass behind it. */}
      <span
        aria-hidden
        className="flex items-start justify-center pt-[18px] sm:pt-6"
      >
        <span
          aria-hidden
          className="block size-3 rounded-full shadow-[0_0_0_3px_var(--background)] sm:size-[14px] sm:shadow-[0_0_0_4px_var(--background)]"
          style={{ backgroundColor: dotFill }}
        />
      </span>

      {/* Single-DOM card. Grid areas relocate the meta cell between the
       *  mobile (last row, top-bordered footer) and desktop (top-right of
       *  the title) layouts — see the `grid-template-areas` and
       *  `grid-area` classes below. */}
      <div
        className="portfolio-card grid min-w-0 grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_auto_auto] gap-x-2.5 gap-y-0 border bg-card p-3.5 transition-colors has-[a:hover]:border-primary [grid-template-areas:'icon_title''pills_pills''meta_meta'] sm:gap-x-3 sm:rounded-2xl sm:px-[22px] sm:py-5 sm:[grid-template-areas:'icon_title_meta''pills_pills_pills']"
        style={{
          borderRadius: 14,
          borderColor: "var(--border)",
          boxShadow: "0 1px 2px rgba(42,24,48,0.06)",
        }}
      >
        <span
          aria-hidden
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-accent text-primary [grid-area:icon] sm:size-[38px] sm:rounded-[10px]"
        >
          <SubmissionIcon className="size-[15px] sm:size-[18px]" />
        </span>

        {/* Title cell — category pill wraps to the right of the title on
         *  desktop, drops below on mobile via block/inline toggling. The
         *  title wraps (not truncates) on phone so longer labels stay
         *  readable; secondary line below may still truncate. */}
        <div className="min-w-0 [grid-area:title]">
          <Link
            href={`/dashboard/portfolio/${item.id}`}
            className="block break-words text-sm font-semibold leading-[1.3] text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:inline sm:text-[15px] sm:leading-tight"
          >
            {item.label}
          </Link>
          <span
            className="mt-[5px] inline-flex items-center rounded-full px-[9px] py-[3px] text-[10.5px] font-semibold whitespace-nowrap sm:mt-0 sm:ml-2 sm:px-2.5 sm:text-[11px]"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
          >
            {categoryLabel}
          </span>
          <p className="mt-1 truncate text-xs text-muted-foreground sm:mt-1 sm:text-[12.5px]">
            {secondaryLineFor(item)}
          </p>
        </div>

        {/* Meta cell — date + delete button. Always present; visually moves
         *  to the footer row on mobile (last grid row, top-bordered) and to
         *  the top-right of the title row on desktop. */}
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[color:var(--border)] pt-2.5 [grid-area:meta] sm:mt-0 sm:justify-end sm:border-0 sm:pt-0">
          <span className="text-[11px] text-muted-foreground sm:text-[11.5px]">{formattedDate}</span>
          <DeleteButton
            item={item}
            deleting={deleting}
            onDelete={onDelete}
          />
        </div>

        {/* Pills cell — status + skill pills + +N more. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 [grid-area:pills] sm:mt-3 sm:gap-2">
          <StatusPill
            background={statusStyle.background}
            color={statusStyle.color}
            label={statusStyle.label}
            icon={<StatusIcon className={cn("size-3 sm:size-[11px]", isAnalyzing && "animate-spin")} />}
          />
          {showSkills && (
            <>
              <span
                aria-hidden
                className="block h-3.5 w-px"
                style={{ backgroundColor: "var(--border)" }}
              />
              <SkillBadgeStrip
                visibleSkills={visibleSkills}
                overflowCount={overflowCount}
              />
            </>
          )}
        </div>
      </div>
    </li>
  );
}

interface DeleteButtonProps {
  item: PortfolioItem;
  deleting: boolean;
  onDelete: () => void;
}

function DeleteButton({ item, deleting, onDelete }: DeleteButtonProps) {
  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={deleting}
      aria-label={`Delete ${item.label}`}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-[#b3261e] transition-colors hover:bg-[rgba(179,38,30,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b3261e]/40 disabled:cursor-not-allowed disabled:opacity-50 sm:size-[34px]"
    >
      {deleting ? (
        <Loader2 className="size-[14px] animate-spin sm:size-[15px]" />
      ) : (
        <Trash2 className="size-[14px] sm:size-[15px]" />
      )}
    </button>
  );
}

interface StatusPillProps {
  background: string;
  color: string;
  label: string;
  icon: React.ReactNode;
}

function StatusPill({ background, color, label, icon }: StatusPillProps) {
  return (
    <Badge background={background} color={color} className="px-[9px] text-[10.5px] sm:px-2.5 sm:text-[11px]">
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </Badge>
  );
}

interface SkillBadgeStripProps {
  visibleSkills: PortfolioItem["skills"];
  overflowCount: number;
}

function SkillBadgeStrip({ visibleSkills, overflowCount }: SkillBadgeStripProps) {
  return (
    <>
      {visibleSkills.map((skill, idx) => {
        const bandStyle = styleForConfidenceBand(skill.confidenceBand as ConfidenceBand);
        return (
          <Badge
            key={`${skill.skillName}-${idx}`}
            background={bandStyle.background}
            color={bandStyle.color}
            aria-label={`${skill.skillName} — ${bandStyle.label}`}
            title={`${skill.skillName} — ${bandStyle.label}`}
            className="px-[9px] text-[10.5px] sm:px-2.5 sm:text-[11px]"
          >
            <span className="font-semibold">{skill.skillName}</span>
          </Badge>
        );
      })}
      {overflowCount > 0 && (
        <span
          aria-label={`${overflowCount} more skill${overflowCount === 1 ? "" : "s"}`}
          className="inline-flex items-center rounded-full bg-muted px-[9px] py-[3px] text-[10.5px] font-semibold text-muted-foreground sm:px-2.5 sm:text-[11px]"
        >
          +{overflowCount} more
        </span>
      )}
    </>
  );
}

function PortfolioEmptyState() {
  return (
    <div className="relative">
      <TimelineSpine variant="dashed" />
      <div className="flex justify-center pt-[66px]">
        <div
          className="flex w-full max-w-[520px] flex-col items-center gap-3.5 border bg-card px-6 py-10 text-center sm:px-14 sm:py-12"
          style={{
            borderRadius: 16,
            borderColor: "var(--border)",
            boxShadow: "0 1px 2px rgba(42,24,48,0.06)",
          }}
        >
          <span
            aria-hidden
            className="flex size-12 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
          >
            <Inbox className="size-5" />
          </span>
          <h3 className="font-heading text-lg font-semibold text-foreground">
            Your timeline starts here
          </h3>
          <p className="max-w-[360px] text-sm text-muted-foreground">
            Add your first file or link above — every item you submit shows up here, in order, with whatever the AI finds in it.
          </p>
        </div>
      </div>
    </div>
  );
}

function PortfolioErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex justify-center pt-3">
      <div
        className="flex w-full max-w-[520px] flex-col items-center gap-3.5 border bg-card px-6 py-10 text-center sm:px-14 sm:py-12"
        style={{
          borderRadius: 16,
          borderColor: "var(--border)",
          boxShadow: "0 1px 2px rgba(42,24,48,0.06)",
        }}
      >
        <span
          aria-hidden
          className="flex size-12 items-center justify-center rounded-full"
          style={{ backgroundColor: "#FBE9E7", color: "#B3261E" }}
        >
          <OctagonAlert className="size-5" />
        </span>
        <h3 className="font-heading text-lg font-semibold text-foreground">
          Couldn&apos;t load your portfolio
        </h3>
        <p className="max-w-[360px] text-sm text-muted-foreground">
          We couldn&apos;t reach the backend just now. Check your connection or the API status, then try again.
        </p>
        <p
          aria-label="Error details"
          className="max-w-[360px] font-mono text-xs text-muted-foreground/80 wrap-break-word [display:-webkit-box] [-webkit-line-clamp:3] [-webkit-box-orient:vertical] [overflow:hidden]"
        >
          {message}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}

function PortfolioListSkeleton() {
  const rowSpecs = [
    [
      { height: 12, width: "45%" },
      { height: 10, width: "30%" },
      { height: 18, width: "22%", isPill: true },
    ],
    [
      { height: 12, width: "55%" },
      { height: 10, width: "35%" },
      { height: 18, width: "26%", isPill: true },
    ],
    [
      { height: 12, width: "40%" },
      { height: 10, width: "28%" },
    ],
  ];

  return (
    <ol
      role="list"
      aria-label="Loading portfolio"
      aria-busy
      className="relative flex flex-col gap-5 sm:gap-7"
    >
      <TimelineSpine variant="solid" />
      {rowSpecs.map((bars, rowIdx) => (
        <li
          key={rowIdx}
          aria-hidden
          className="relative grid grid-cols-[24px_1fr] items-start gap-3 sm:grid-cols-[32px_1fr] sm:gap-5"
        >
          <span className="flex items-start justify-center pt-[18px] sm:pt-6">
            <span
              className="block size-3 animate-pulse rounded-full bg-muted-foreground shadow-[0_0_0_3px_var(--background)] sm:size-[14px] sm:shadow-[0_0_0_4px_var(--background)] motion-reduce:animate-none"
              style={{ animationDelay: `${rowIdx * 0.2}s` }}
            />
          </span>

          <div
            className="border bg-card"
            style={{
              borderRadius: 14,
              padding: 14,
              borderColor: "var(--border)",
              boxShadow: "0 1px 2px rgba(42,24,48,0.06)",
            }}
          >
            <div className="flex items-start gap-2.5 sm:gap-3">
              <span
                aria-hidden
                className="mt-0.5 block shrink-0 animate-pulse rounded-[9px] bg-muted motion-reduce:animate-none sm:rounded-[10px]"
                style={{
                  width: 32,
                  height: 32,
                  animationDelay: `${rowIdx * 0.2}s`,
                }}
              />
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                {bars.map((bar, barIdx) => (
                  <span
                    key={barIdx}
                    aria-hidden
                    className="block animate-pulse bg-muted motion-reduce:animate-none"
                    style={{
                      height: bar.height,
                      width: bar.width,
                      borderRadius: bar.isPill ? 999 : 6,
                      marginTop: bar.isPill ? 4 : 0,
                      animationDelay: `${rowIdx * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// Form helpers — kept verbatim above the timeline section for context. The
// submission form region above `TimelineSection` is intentionally untouched;
// these helpers are only consumed by the form, not the timeline.
// ---------------------------------------------------------------------------

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function TabButton({ active, onClick, icon, children }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "inline-flex h-8 items-center gap-1.5 rounded-md bg-background px-3 text-sm font-semibold text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          : "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      }
    >
      {icon}
      {children}
    </button>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}

function Field({ label, htmlFor, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

interface FilePickerProps {
  file: File | null;
  onChange: (file: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function FilePicker({ file, onChange, inputRef }: FilePickerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="portfolio-file" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        File
      </label>
      <div className="flex flex-col items-start gap-3 rounded-xl border-2 border-dashed bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {file ? file.name : "No file selected"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF, DOC, image, video, or ZIP — up to 100MB
          </p>
        </div>
        <div>
          <input
            ref={inputRef}
            id="portfolio-file"
            type="file"
            className="sr-only"
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            Browse
          </Button>
        </div>
      </div>
    </div>
  );
}

interface LinkFieldProps {
  value: string;
  onChange: (next: string) => void;
}

function LinkField({ value, onChange }: LinkFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="portfolio-url" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        URL
      </label>
      <input
        id="portfolio-url"
        type="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://github.com/you/project"
        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
    </div>
  );
}
