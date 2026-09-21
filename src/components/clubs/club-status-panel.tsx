"use client";

import { Check, Circle, Loader2 } from "lucide-react";

import type { ClubProfileStatus } from "@/lib/api/clubs";
import { Button } from "@/components/ui/button";

import type { PublishItem } from "./club-helpers";

const PILL =
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold";

export function ClubStatusPill({ status }: { status: ClubProfileStatus }) {
  const published = status === "Published";
  return (
    <span
      className={PILL}
      style={{
        backgroundColor: published ? "#e6f4ea" : "#f3efdd",
        color: published ? "#1e7b34" : "#6e6488",
      }}
    >
      {status}
    </span>
  );
}

/**
 * Where the profile stands: Draft or Published, what is still missing before
 * it can be published, and the Publish or Unpublish button.
 */
export function ClubStatusPanel({
  status,
  checklist,
  busy,
  notice,
  onPublish,
  onUnpublish,
}: {
  status: ClubProfileStatus;
  checklist: PublishItem[];
  busy: "save" | "publish" | "unpublish" | null;
  notice: string | null;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const missing = checklist.filter((i) => !i.done);
  const published = status === "Published";

  return (
    <section
      aria-labelledby="club-status-heading"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="club-status-heading" className="font-heading text-lg font-semibold text-foreground">
            Profile status
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {published
              ? "Companies can find and read this profile."
              : "Only you can see this profile."}
          </p>
        </div>
        <ClubStatusPill status={status} />
      </div>

      {missing.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            What is missing to publish
          </p>
          <ul className="flex flex-col gap-1.5">
            {checklist.map((item) => (
              <li
                key={item.key}
                className={
                  item.done
                    ? "flex items-center gap-2 text-sm text-muted-foreground"
                    : "flex items-center gap-2 text-sm font-medium text-foreground"
                }
              >
                {item.done ? (
                  <Check className="size-4 shrink-0 text-[#1e7b34]" aria-hidden />
                ) : (
                  <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span>{item.label}</span>
                <span className="sr-only">{item.done ? "Done" : "Missing"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-foreground">
          <Check className="size-4 shrink-0 text-[#1e7b34]" aria-hidden />
          Everything needed to publish is filled in.
        </p>
      )}

      {notice ? (
        <p role="status" className="text-sm font-medium text-[#1e7b34]">
          {notice}
        </p>
      ) : null}

      <div
        className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center"
        style={{ borderColor: "var(--border)" }}
      >
        {published ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={busy !== null}
            onClick={onUnpublish}
            className="h-10 sm:h-9"
          >
            {busy === "unpublish" ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : null}
            {busy === "unpublish" ? "Unpublishing…" : "Unpublish"}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              size="lg"
              disabled={missing.length > 0 || busy !== null}
              aria-describedby={missing.length > 0 ? "club-publish-reason" : undefined}
              onClick={onPublish}
              className="h-10 px-4 sm:h-9"
            >
              {busy === "publish" ? (
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
              ) : null}
              {busy === "publish" ? "Publishing…" : "Publish"}
            </Button>
            {missing.length > 0 ? (
              <p id="club-publish-reason" className="text-xs text-muted-foreground">
                Fill in the missing items to publish.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
