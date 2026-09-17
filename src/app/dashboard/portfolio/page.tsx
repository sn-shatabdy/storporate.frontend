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
  type PortfolioSkillPreview,
} from "@/lib/api/portfolio";
import {
  styleForAnalysisStatus,
  styleForConfidenceBand,
  type AnalysisStatus,
} from "@/lib/portfolio/analysis-status";
import { cn } from "cn";

const PAGE_SIZE = 100;

/** How many condensed skill badges we show per timeline entry before
 * collapsing the rest into a single "+N more" badge. Picked so three
 * common-case skills are visible without horizontal overflow on a phone
 * viewport; the rest roll up under one muted "+N more" indicator. */
const SKILL_BADGE_PREVIEW_LIMIT = 3;

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

/** Total number of AI-identified skills across every item the student has
 * submitted. Returned alongside `count` from the list endpoint's
 * `PortfolioItemResponse.Skills` arrays (Phase 1 backend change). `0` for a
 * brand-new account that hasn't had any analyses complete yet — used by
 * {@link summaryLine} to decide whether to mention skills in the header. */
function totalSkillCount(items: PortfolioItem[]): number {
  let total = 0;
  for (const item of items) {
    total += item.skills.length;
  }
  return total;
}

function summaryLine(count: number, skillCount: number): string {
  if (count === 0) return "No items yet";
  // Only mention skills if at least one analysis has produced findings —
  // keeps the header plain for brand-new accounts or items still queued.
  if (skillCount > 0) {
    const itemPart = count === 1 ? "1 item" : `${count} items`;
    const skillPart = skillCount === 1 ? "1 skill identified" : `${skillCount} skills identified`;
    return `${itemPart} · ${skillPart}`;
  }
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
              <span className="text-xs font-medium text-muted-foreground">
                {summaryLine(listState.totalCount, totalSkillCount(listState.items))}
              </span>
            )}
          </div>

          {listState.status === "loading" && <PortfolioListSkeleton />}

          {listState.status === "success" && listState.items.length === 0 && (
            <PortfolioEmptyState />
          )}

          {listState.status === "success" && listState.items.length > 0 && (
            <PortfolioTimeline>
              {listState.items.map((item) => (
                <PortfolioTimelineEntry
                  key={item.id}
                  item={item}
                  deleting={deletingId === item.id}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}
            </PortfolioTimeline>
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
}

/**
 * Reverse-chronological timeline wrapper. Carries the absolute-positioned
 * vertical spine (a single 2px line down the left gutter) so each entry
 * only has to render its own dot and card. The spine is `aria-hidden`
 * because the visual order already encodes chronological order — a screen
 * reader doesn't need an extra "spine" announcement. Items render newest-
 * first because the list endpoint already returns them that way (the page
 * never sorts in place).
 */
function PortfolioTimeline({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-2 bottom-2 left-[11px] w-0.5 bg-border sm:top-2 sm:bottom-2 sm:left-[15px]"
      />
      <ul className="flex flex-col gap-5 sm:gap-7">{children}</ul>
    </div>
  );
}

function PortfolioTimelineEntry({ item, deleting, onDelete }: PortfolioRowProps) {
  const categoryLabel = CATEGORY_LABEL_BY_VALUE[item.category] ?? item.category;
  // `styleForAnalysisStatus` falls back to the NotAnalyzed entry if the wire
  // value is something we don't know yet — mirrors the defensive lookup
  // pattern `severityForAction` uses for unknown audit-log action strings.
  const statusStyle = styleForAnalysisStatus(item.analysisStatus as AnalysisStatus);
  const StatusIcon = statusStyle.icon;
  const isAnalyzing = item.analysisStatus === "Analyzing";
  const createdAtLabel = formatCreatedAt(item.createdAt);
  // Dot fill mirrors the badge's foreground color — one source of truth so
  // an added status (Failed, etc.) stays visually in sync automatically.
  const dotColor = statusStyle.color;
  const skills = item.skills;
  const visibleSkills = skills.slice(0, SKILL_BADGE_PREVIEW_LIMIT);
  const extraSkills = Math.max(0, skills.length - visibleSkills.length);

  return (
    <li className="grid grid-cols-[24px_1fr] gap-x-3 sm:grid-cols-[32px_1fr] sm:gap-x-5">
      <div className="flex justify-center pt-4 sm:pt-6">
        <span
          aria-hidden="true"
          className="block rounded-full"
          style={{
            width: 12,
            height: 12,
            backgroundColor: dotColor,
            boxShadow: "0 0 0 4px var(--background)",
          }}
        />
      </div>

      <article
        className="border bg-card p-3.5 shadow-sm sm:p-5"
        style={{ borderRadius: 14, borderColor: "var(--border)" }}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary sm:size-10"
            >
              {item.submissionType === "File" ? (
                <FileText className="size-4 sm:size-5" />
              ) : (
                <Link2 className="size-4 sm:size-5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <Link
                  href={`/dashboard/portfolio/${item.id}`}
                  className="rounded-sm text-sm font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  {item.label}
                </Link>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-foreground)",
                  }}
                >
                  {categoryLabel}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {secondaryLineFor(item)}
              </p>
            </div>
          </div>

          {/* Desktop-only date + delete cluster — sits to the right of the
              header. On mobile this content moves into the bottom meta row
              so the header stays compact. */}
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
              {createdAtLabel}
            </span>
            <DeleteButton
              item={item}
              deleting={deleting}
              onDelete={onDelete}
            />
          </div>
        </header>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge
            background={statusStyle.background}
            color={statusStyle.color}
            aria-label={statusStyle.label}
          >
            <StatusIcon className={cn("size-3", isAnalyzing && "animate-spin")} />
            {statusStyle.label}
          </Badge>

          {visibleSkills.length > 0 && (
            <span
              aria-hidden="true"
              className="h-3.5 w-px bg-border"
            />
          )}

          {visibleSkills.map((skill, idx) => (
            <SkillBadge key={`${skill.skillName}-${idx}`} skill={skill} />
          ))}

          {extraSkills > 0 && (
            <Badge
              background="var(--muted)"
              color="var(--muted-foreground)"
              aria-label={`${extraSkills} more skills`}
            >
              +{extraSkills} more
            </Badge>
          )}
        </div>

        {item.analysisStatus === "Failed" && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            See the item&apos;s page to retry.
          </p>
        )}
        {item.analysisStatus === "Unsupported" && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Video files aren&apos;t analyzed yet.
          </p>
        )}

        {/* Mobile-only bottom meta row: date on the left, delete on the
            right, separated from the rest of the card by a top border so
            the row reads as metadata rather than content. */}
        <div className="mt-2.5 flex items-center justify-between border-t pt-2.5 sm:hidden" style={{ borderColor: "var(--border)" }}>
          <span className="text-[11px] text-muted-foreground">{createdAtLabel}</span>
          <DeleteButton
            item={item}
            deleting={deleting}
            onDelete={onDelete}
          />
        </div>
      </article>
    </li>
  );
}

/** A condensed skill badge — uses the per-confidence-band color so the dot
 * fill, the detail-page pill, and the timeline pill all read from the same
 * map. The badge text is the skill NAME (not the confidence band label)
 * because on a timeline the student is scanning "what skills were found"
 * more often than "how confident". */
function SkillBadge({ skill }: { skill: PortfolioSkillPreview }) {
  const bandStyle = styleForConfidenceBand(skill.confidenceBand);
  return (
    <Badge
      background={bandStyle.background}
      color={bandStyle.color}
      aria-label={`${skill.skillName} — ${bandStyle.label}`}
    >
      {skill.skillName}
    </Badge>
  );
}

/** The trash-can button. Extracted so the desktop and mobile positions can
 * share identical markup, accessibility wiring, and delete behavior — the
 * spec called for keeping the existing button's logic unchanged and only
 * relocating it. */
function DeleteButton({
  item,
  deleting,
  onDelete,
}: {
  item: PortfolioItem;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={deleting}
      aria-label={`Delete ${item.label}`}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {deleting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Trash2 className="size-4" />
      )}
    </button>
  );
}

function PortfolioEmptyState() {
  return (
    <div className="relative pl-[35px] sm:pl-[39px]">
      {/* Short dashed spine stub so the empty state visually anchors to the
          same vertical line a real entry would — the same gutter, just
          truncated to ~48px so the eye reads "the timeline begins here"
          without competing with the empty-state card. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-[11px] w-0.5 sm:left-[15px]"
        style={{
          height: 48,
          backgroundImage:
            "repeating-linear-gradient(to bottom, var(--border) 0 4px, transparent 4px 8px)",
        }}
      />
      <div
        className="flex flex-col items-center gap-3 border bg-card p-12 text-center shadow-sm"
        style={{ borderRadius: 16, borderColor: "var(--border)" }}
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
        <p className="max-w-sm text-sm text-muted-foreground">
          Add your first file or link above to start building it.
        </p>
      </div>
    </div>
  );
}

function PortfolioErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-3 border bg-card p-12 text-center shadow-sm"
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

function PortfolioListSkeleton() {
  // Three timeline-shaped placeholder rows: pulsing dot in the dot column
  // + a card with icon placeholder + 2-3 text bars + a pill placeholder.
  // Synchronized animate-pulse across all rows (intentional — keeps the
  // loading state calm and predictable; staggered delay wasn't worth the
  // extra motion for what's already a brief loading window).
  return (
    <div className="relative" aria-label="Loading portfolio" aria-busy="true">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-2 bottom-2 left-[11px] w-0.5 bg-border sm:left-[15px]"
      />
      <ul className="flex flex-col gap-5 sm:gap-7">
        {Array.from({ length: 3 }).map((_, idx) => (
          <li
            key={idx}
            className="grid grid-cols-[24px_1fr] gap-x-3 sm:grid-cols-[32px_1fr] sm:gap-x-5"
          >
            <div className="flex justify-center pt-4 sm:pt-6">
              <span
                aria-hidden="true"
                className="block size-3 animate-pulse rounded-full bg-muted-foreground/40"
              />
            </div>
            <div
              className="border bg-card p-3.5 shadow-sm sm:p-5"
              style={{ borderRadius: 14, borderColor: "var(--border)" }}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 block size-9 shrink-0 animate-pulse rounded-lg bg-muted sm:size-10"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <span className="block h-3 w-1/3 animate-pulse rounded bg-muted" />
                  <span className="block h-3 w-2/3 animate-pulse rounded bg-muted" />
                  <span className="mt-2 block h-5 w-24 animate-pulse rounded-full bg-muted" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
