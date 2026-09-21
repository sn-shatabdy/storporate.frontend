"use client";

import { useEffect, useRef } from "react";
import { Download, X } from "lucide-react";

import { typeLabelFor } from "./helpers";

/** Inline file preview that appears directly below the item's
 *  "Open original" row when the user opens a File item. The parent
 *  owns the fetch + ObjectURL lifecycle; this viewer just renders
 *  metadata + a blob URL. Focus moves to the close button on open,
 *  returns to `restoreFocusRef.current` on close, and Escape closes
 *  the viewer. */
export interface OriginalViewerProps {
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
  objectUrl: string;
  onClose: () => void;
  onDownload: () => void;
  /** Ref pointing at the button that opened the viewer so we can
   *  return focus there on close. */
  restoreFocusRef: React.RefObject<HTMLButtonElement | null>;
}

const VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);
const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export function OriginalViewer({
  fileName,
  contentType,
  sizeBytes,
  objectUrl,
  onClose,
  onDownload,
  restoreFocusRef,
}: OriginalViewerProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeBtnRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function handleClose() {
    onClose();
    // Returning focus is best-effort — the parent might unmount us
    // synchronously, in which case the ref still points at the
    // mounted "Open original" button.
    restoreFocusRef.current?.focus();
  }

  const typeLabel = typeLabelFor(contentType);
  const lowered = contentType.toLowerCase();
  const isPdf = lowered === "application/pdf";
  const isImage = IMAGE_MIMES.has(lowered);
  const isVideo = VIDEO_MIMES.has(lowered);

  return (
    <div
      role="dialog"
      aria-label={fileName}
      className="mt-3 overflow-hidden rounded-2xl border bg-card"
      style={{
        borderColor: "var(--border)",
        boxShadow: "0 8px 32px rgba(42,24,48,0.18)",
      }}
    >
      <div
        className="flex flex-wrap items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0 flex-1">
          <p className="break-words font-heading text-[15px] font-semibold text-foreground">
            {fileName}
          </p>
          <p className="text-xs text-muted-foreground">
            {typeLabel}
            {sizeBytes !== null ? ` · ${humanSize(sizeBytes)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex h-9 items-center gap-2 rounded-[10px] border bg-white px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          style={{ borderColor: "#e7dfc0" }}
        >
          <Download className="size-4" aria-hidden />
          Download
        </button>
        <button
          ref={closeBtnRef}
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border bg-white text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          style={{ borderColor: "#e7dfc0" }}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="h-[420px] bg-secondary max-sm:h-[320px]">
        {isPdf ? (
          <iframe
            title={fileName}
            sandbox=""
            src={objectUrl}
            className="h-full w-full border-0"
          />
        ) : isImage ? (
          // The src is a per-session blob URL, so next/image cannot
          // optimize it; the spec calls for a plain <img alt=...>.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={fileName}
            src={objectUrl}
            className="mx-auto h-full w-full object-contain"
          />
        ) : isVideo ? (
          <video
            controls
            src={objectUrl}
            className="h-full w-full"
            aria-label={fileName}
          />
        ) : null}
      </div>
    </div>
  );
}

/** "12 B" / "340 KB" / "2.4 MB" for the viewer's subtitle line;
 *  always 1-decimal above KB so the subtitle matches "{type} · {size}". */
function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
