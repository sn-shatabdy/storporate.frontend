"use client";

import {
  AlertTriangle,
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
} from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import {
  type CandidateItem,
  type CandidateSkill,
} from "@/lib/api/candidateReview";

import { formatFileSize, typeLabelFor } from "./helpers";

/** Per-portfolio-item card on the drill-down page. Composition
 *  only — the parent page owns the "viewer open" coordination +
 *  ObjectURL lifecycle so only one viewer is ever mounted at a time. */
export interface CandidateItemCardProps {
  item: CandidateItem;
  candidateId: string;
  bearerToken: string;
  /** Local status for the open flow. Owned by the card because
   *  the parent doesn't need it (it only cares about the
   *  result). The card resets `pending → idle` when the parent
   *  signals a successful mount / download / popup via the prop
   *  flip below. */
  openStatus: OpenStatus;
  /** Called when the user clicks "Open original" or "Open link".
   *  The parent runs the fetch and either mounts the viewer,
   *  triggers the download, or returns an error. */
  onOpen: () => void;
  /** Currently-shown transient download-status line (e.g.
   *  "Download started.") — auto-cleared after ~3 seconds. */
  downloadStatus: string | null;
  /** Ref to the "Open original" / "Open link" button so the
   *  inline viewer can return focus here on close. */
  openButtonRef: React.RefObject<HTMLButtonElement | null>;
}

export type OpenStatus =
  | { kind: "idle" }
  | { kind: "pending" }
  | {
      kind: "error";
      title: string;
      body: string;
      retryable: boolean;
    };

export const INLINE_SAFE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
]);

export const PREVIEW_MAX_BYTES = 25 * 1024 * 1024;

export function CandidateItemCard({
  item,
  openStatus,
  onOpen,
  downloadStatus,
  openButtonRef,
}: CandidateItemCardProps) {
  const isShared = item.shared;
  const original = item.original;
  const TitleIcon = original?.kind === "Link" ? Link2 : FileText;

  return (
    <li
      className="flex flex-col gap-4 border bg-card p-[22px] shadow-sm"
      style={{ borderRadius: 16, borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent text-primary"
        >
          <TitleIcon className="size-4" aria-hidden />
        </span>
        <h3 className="min-w-0 flex-1 break-words font-heading text-[17px] font-semibold text-foreground">
          {item.label}
        </h3>
        <span
          className="rounded-full bg-accent px-[9px] py-[3px] text-[11px] font-semibold text-foreground"
        >
          {item.category}
        </span>
      </div>

      {isShared ? (
        <SharedSkills skills={item.skills} />
      ) : (
        <UnsharedSkills skills={item.skills} />
      )}

      {isShared && original && (
        <OriginalRow
          original={original}
          status={openStatus}
          onOpen={onOpen}
          // Disable only while this card's own fetch is in flight;
          // opening another item's original closes the current viewer
          // first, so that case is not a disable condition.
          disabled={openStatus.kind === "pending"}
          buttonRef={openButtonRef}
        />
      )}

      {isShared && openStatus.kind === "error" && (
        <ItemError
          title={openStatus.title}
          body={openStatus.body}
          retryable={openStatus.retryable}
          onRetry={onOpen}
        />
      )}

      {isShared && downloadStatus && (
        <p role="status" className="text-sm text-muted-foreground">
          {downloadStatus}
        </p>
      )}

      {!isShared && (
        <div
          className="flex items-center gap-2 border-t pt-3.5 text-[13px] text-muted-foreground"
          style={{ borderColor: "var(--border)" }}
        >
          <Lock className="size-[15px]" aria-hidden />
          <span>The student has not shared the original.</span>
        </div>
      )}
    </li>
  );
}

interface SharedSkillsProps {
  skills: CandidateSkill[];
}
function SharedSkills({ skills }: SharedSkillsProps) {
  return (
    <div className="flex flex-col gap-3">
      {skills.map((skill) => {
        const hasReason =
          skill.reason !== null && skill.reason.trim().length > 0;
        return (
          <div
            key={`${skill.name}-${skill.band}`}
            className="flex flex-col gap-1.5"
          >
            <SkillPill name={skill.name} band={skill.band} />
            {hasReason && (
              <p className="text-sm leading-relaxed text-foreground">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Why this rating
                </span>
                <br />
                <span className="break-words">{skill.reason}</span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface UnsharedSkillsProps {
  skills: CandidateSkill[];
}
function UnsharedSkills({ skills }: UnsharedSkillsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <SkillPill
          key={`${skill.name}-${skill.band}`}
          name={skill.name}
          band={skill.band}
        />
      ))}
    </div>
  );
}

function SkillPill({
  name,
  band,
}: {
  name: string;
  band: CandidateSkill["band"];
}) {
  const palette = lookupBandPalette(band);
  return (
    <span
      className="self-start rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{ backgroundColor: palette.background, color: palette.color }}
    >
      {name} · {band}
    </span>
  );
}

function lookupBandPalette(band: "Strong" | "Developing"): {
  background: string;
  color: string;
} {
  if (band === "Strong") return { background: "#e6f4ea", color: "#1e7b34" };
  return { background: "#fbeee7", color: "#a4460f" };
}

interface OriginalRowProps {
  original: NonNullable<CandidateItem["original"]>;
  status: OpenStatus;
  onOpen: () => void;
  disabled: boolean;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}
function OriginalRow({
  original,
  status,
  onOpen,
  disabled,
  buttonRef,
}: OriginalRowProps) {
  const isFile = original.kind === "File";
  const fileNameLabel =
    original.fileName && original.fileName.trim().length > 0
      ? original.fileName
      : isFile
      ? "Original file"
      : original.host ?? "Link";
  const subtitleLine = isFile
    ? `${typeLabelFor(original.contentType)}${
        original.sizeBytes !== null
          ? ` · ${formatFileSize(original.sizeBytes)}`
          : ""
      }`
    : "Link. Opens in a new tab.";
  const buttonLabel = isFile ? "Open original" : "Open link";
  const ButtonIcon = isFile ? Eye : ExternalLink;

  return (
    <div
      className="flex flex-wrap items-center gap-3 border-t pt-3.5"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold text-foreground">
          {fileNameLabel}
        </p>
        <p className="text-[12.5px] text-muted-foreground">{subtitleLine}</p>
      </div>
      <button
        ref={buttonRef}
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className="inline-flex h-9 items-center gap-2 rounded-[10px] px-4 text-sm font-semibold text-white transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-70"
        style={{
          backgroundColor: "#4d7ea0",
          borderColor: "#4d7ea0",
          borderWidth: 1,
        }}
      >
        {status.kind === "pending" ? (
          <>
            <Loader2
              className="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden
            />
            Opening…
          </>
        ) : (
          <>
            <ButtonIcon className="size-4" aria-hidden />
            {buttonLabel}
          </>
        )}
      </button>
    </div>
  );
}

function ItemError({
  title,
  body,
  retryable,
  onRetry,
}: {
  title: string;
  body: string;
  retryable: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3.5 rounded-[14px] border p-4"
      style={{
        borderColor: "rgba(179,38,30,0.25)",
        backgroundColor: "#fbe9e7",
      }}
    >
      <span
        aria-hidden
        className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-white text-[#b3261e]"
      >
        <AlertTriangle className="size-[18px]" strokeWidth={1.9} aria-hidden />
      </span>
      <div className="flex flex-col items-start gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-[15px] font-semibold leading-tight text-foreground">
            {title}
          </span>
          <span className="text-sm text-foreground">{body}</span>
        </div>
        {retryable && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-[10px] border bg-white px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            style={{ borderColor: "#e7dfc0" }}
          >
            <RefreshCw className="size-4" aria-hidden />
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

/** Map an `ApiError` thrown by `fetchCandidateOriginal` into the local
 *  `OpenStatus` shape. Returns the "no longer available" sentinel for
 *  `original_not_shared` / `original_unavailable` and the "Try again"
 *  sentinel for any other error / network failure. */
export function openStatusForError(error: unknown): OpenStatus {
  if (
    error instanceof ApiError &&
    (error.errorCode === "original_unavailable" ||
      error.errorCode === "original_not_shared")
  ) {
    return {
      kind: "error",
      title: "This original is no longer available.",
      body: "The student may have removed it.",
      retryable: false,
    };
  }
  return {
    kind: "error",
    title: "Could not open the original",
    body: "Try again.",
    retryable: true,
  };
}
