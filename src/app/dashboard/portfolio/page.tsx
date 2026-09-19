"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertOctagon,
  FileText,
  Inbox,
  Link2,
  Loader2,
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

/** How many condensed skill badges to show inline per timeline entry before
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

function summaryLine(count: number): string {
  if (count === 0) return "No items yet";
  if (count === 1) return "1 item in your portfolio";
  return `${count} items in your portfolio`;
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
                <p role="alert" className="text-sm text-destructive">
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

        <section className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold text-foreground">Your portfolio</h2>
            {listState.status === "success" && (
              <span className="text-xs font-medium text-muted-foreground">{summaryLine(listState.totalCount)}</span>
            )}
          </div>

          {listState.status === "loading" && <PortfolioListSkeleton />}

          {listState.status === "success" && listState.items.length === 0 && (
            <PortfolioEmptyState />
          )}

          {listState.status === "success" && listState.items.length > 0 && (
            <TimelineList
              items={listState.items}
              deletingId={deletingId}
              onDelete={handleDelete}
            />
          )}

          {listState.status === "error" && (
            <PortfolioErrorState
              message={listState.message}
              onRetry={() => setListVersion((v) => v + 1)}
            />
          )}
        </section>
      </div>
    </div>
  );
}

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
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://github.com/you/project"
        className="h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
    </div>
  );
}

interface PortfolioRowProps {
  item: PortfolioItem;
  deleting: boolean;
  onDelete: () => void;
  /** Position in the list — first and last rows get a half-dot treatment so
   * the spine reads as a continuous line, not a row of floating circles. */
  position: "first" | "middle" | "last" | "only";
}

function PortfolioRow({ item, deleting, onDelete, position }: PortfolioRowProps) {
  const categoryLabel = CATEGORY_LABEL_BY_VALUE[item.category] ?? item.category;
  // `styleForAnalysisStatus` falls back to the NotAnalyzed entry if the wire
  // value is something we don't know yet — mirrors the defensive lookup
  // pattern `severityForAction` uses for unknown audit-log action strings.
  const statusStyle = styleForAnalysisStatus(item.analysisStatus as AnalysisStatus);
  const StatusIcon = statusStyle.icon;
  const isAnalyzing = item.analysisStatus === "Analyzing";

  // Solid dot for middle/only entries; half-circle "open" dots for the
  // first and last so the spine reads as a continuous line. The dot's fill
  // uses the same hex pair as the status badge so a glance reads the
  // analysis state straight off the timeline shape.
  const dotBg = statusStyle.color;
  return (
    <li className="relative flex items-start gap-4">
      {/* Spine dot — positioned in the left rail, hidden below `sm:` in
       *  favor of an inline dot at the top-left of the card. */}
      <span
        aria-hidden
        className="hidden sm:flex shrink-0 pt-5"
        style={{ width: 28, justifyContent: "center" }}
      >
        {position === "first" || position === "last" ? (
          <span
            className="block h-5 w-5 rounded-full ring-4 ring-background"
            style={{
              background: `radial-gradient(circle at ${position === "first" ? "top" : "bottom"} 50%, ${dotBg} 50%, transparent 50%)`,
              marginTop: position === "first" ? 2 : -2,
            }}
          />
        ) : (
          <span
            className="block size-5 rounded-full ring-4 ring-background"
            style={{ backgroundColor: dotBg, marginTop: 2 }}
          />
        )}
      </span>

      <div
        className="min-w-0 flex-1 border bg-card p-4 shadow-sm transition-colors has-[a:hover]:border-primary sm:p-5"
        style={{ borderRadius: 16, borderColor: "var(--border)" }}
      >
        <div className="flex items-start gap-4">
          {/* Mobile-only dot — replaces the spine dot below the `sm:` breakpoint.
           *  Uses the same hex pair as a 1px-thick ring inside a filled disc
           *  so the visual language is consistent across breakpoints. */}
          <span
            aria-hidden
            className="sm:hidden mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ring-2 ring-card"
            style={{ backgroundColor: dotBg }}
          />

          <span
            aria-hidden
            className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"
          >
            {item.submissionType === "File" ? <FileText className="size-5" /> : <Link2 className="size-5" />}
          </span>

          <Link
            href={`/dashboard/portfolio/${item.id}`}
            className="min-w-0 flex-1 block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{item.label}</p>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                {categoryLabel}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">{secondaryLineFor(item)}</p>
            <p className="mt-1 text-xs text-muted-foreground">Added {formatCreatedAt(item.createdAt)}</p>
          </Link>

          <Badge
            background={statusStyle.background}
            color={statusStyle.color}
            className="flex-shrink-0 mt-0.5"
            aria-label={statusStyle.label}
          >
            <StatusIcon className={cn("size-3", isAnalyzing && "animate-spin")} />
            {statusStyle.label}
          </Badge>

          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label={`Delete ${item.label}`}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
          </button>
        </div>

        {/* Condensed AI skill preview — only shown when the item has actually
         *  been analyzed and the backend returned skill findings. Not-analyzed
         *  items render only the status badge above. The overflow indicator
         *  collapses N>VISIBLE_SKILL_BADGES extra findings into a single
         *  "+N more" pill so a long skill list never breaks the row's shape. */}
        {item.analysisStatus === "Analyzed" && item.skills.length > 0 && (
          <SkillBadgeStrip skills={item.skills} max={VISIBLE_SKILL_BADGES} />
        )}
      </div>
    </li>
  );
}

interface SkillBadgeStripProps {
  skills: PortfolioItem["skills"];
  max: number;
}

function SkillBadgeStrip({ skills, max }: SkillBadgeStripProps) {
  const visible = skills.slice(0, max);
  const overflow = skills.length - visible.length;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-[3.5rem] sm:pl-14">
      {visible.map((skill, idx) => {
        const bandStyle = styleForConfidenceBand(skill.confidenceBand as ConfidenceBand);
        return (
          <Badge
            key={`${skill.skillName}-${idx}`}
            background={bandStyle.background}
            color={bandStyle.color}
            aria-label={`${skill.skillName} — ${bandStyle.label}`}
          >
            <span className="font-semibold">{skill.skillName}</span>
            <span aria-hidden className="opacity-70">·</span>
            <span>{bandStyle.label}</span>
          </Badge>
        );
      })}
      {overflow > 0 && (
        <span
          aria-label={`${overflow} more skill${overflow === 1 ? "" : "s"}`}
          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
        >
          +{overflow} more
        </span>
      )}
    </div>
  );
}

interface TimelineListProps {
  items: PortfolioItem[];
  deletingId: string | null;
  onDelete: (id: string) => void;
}

function TimelineList({ items, deletingId, onDelete }: TimelineListProps) {
  // Position each row so first/last get half-dot spine treatments. n=1 is
  // "only" — a single full dot with no spine behind it.
  const positionFor = (idx: number): PortfolioRowProps["position"] => {
    if (items.length === 1) return "only";
    if (idx === 0) return "first";
    if (idx === items.length - 1) return "last";
    return "middle";
  };

  return (
    <ol
      role="list"
      aria-label="Portfolio timeline"
      className="relative flex flex-col"
    >
      <TimelineSpine />
      {items.map((item, idx) => (
        <PortfolioRow
          key={item.id}
          item={item}
          deleting={deletingId === item.id}
          onDelete={() => onDelete(item.id)}
          position={positionFor(idx)}
        />
      ))}
    </ol>
  );
}

function PortfolioEmptyState() {
  return (
    <div
      className="flex flex-col items-center gap-3 border bg-card p-10 text-center shadow-sm sm:p-12"
      style={{ borderRadius: 16, borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
      >
        <Inbox className="size-5" />
      </span>
      <h3 className="font-heading text-lg font-semibold text-foreground">Your portfolio is empty</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Add your first file or link above to start building it.
      </p>
    </div>
  );
}

function PortfolioErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-3 border bg-card p-10 text-center shadow-sm sm:p-12"
      style={{ borderRadius: 16, borderColor: "var(--border)" }}
    >
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "#FBE9E7", color: "#B3261E" }}
      >
        <AlertOctagon className="size-5" />
      </span>
      <h3 className="font-heading text-lg font-semibold text-foreground">
        Couldn&apos;t load your portfolio
      </h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        We couldn&apos;t reach the backend just now. Check your connection or the API status, then try again.
      </p>
      <p className="max-w-sm text-xs font-mono text-muted-foreground/80">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/** Shared 1px vertical connector behind the timeline dots. Used by both the
 * populated <TimelineList> and the loading <PortfolioListSkeleton> so the
 * page never reflows when data lands. Hidden below `sm:` because the rail
 * is too narrow to be useful at phone widths — the mobile layout switches
 * to inline dots instead. */
function TimelineSpine() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute hidden sm:block"
      style={{
        left: 13, // (28px rail - 2px) — centers a 1px spine on the 20px dot
        top: 24,
        bottom: 24,
        width: 1,
        backgroundColor: "var(--border)",
      }}
    />
  );
}

function PortfolioListSkeleton() {
  return (
    <ol aria-label="Loading portfolio" className="relative flex flex-col">
      <TimelineSpine />
      {Array.from({ length: 2 }).map((_, idx) => (
        <li key={idx} className="relative flex items-start gap-4 pb-1" aria-hidden>
          <span
            aria-hidden
            className="hidden sm:block shrink-0 pt-5"
            style={{ width: 28, justifyContent: "center" }}
          >
            <span
              className="block size-5 animate-pulse rounded-full bg-muted ring-4 ring-background"
              style={{ marginTop: 2 }}
            />
          </span>
          <div
            className="min-w-0 flex-1 border bg-card p-4 shadow-sm sm:p-5"
            style={{ borderRadius: 16, borderColor: "var(--border)" }}
          >
            <div className="flex items-start gap-4">
              <span aria-hidden className="sm:hidden mt-0.5 size-6 shrink-0 animate-pulse rounded-full bg-muted" />
              <span aria-hidden className="size-10 shrink-0 animate-pulse rounded-lg bg-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <span className="block h-3 w-1/3 animate-pulse rounded bg-muted" />
                <span className="block h-3 w-1/2 animate-pulse rounded bg-muted" />
                <span className="block h-3 w-1/4 animate-pulse rounded bg-muted" />
              </div>
              <span aria-hidden className="mt-0.5 size-9 shrink-0 animate-pulse rounded-md bg-muted" />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
