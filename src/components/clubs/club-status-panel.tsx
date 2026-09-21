import { Check, Circle, Loader2, RefreshCw } from "lucide-react";

import { cn } from "cn";

import type { ClubProfileStatus } from "@/lib/api/clubs";
import { Button } from "@/components/ui/button";

import type { PublishItem } from "./club-helpers";

const PILL =
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold";

/**
 * STOR-69 Phase 2 — Draft / Published pill. Two tokens, no hex: a muted
 * pill for Draft and the accent-tinted pill for Published, both inheriting
 * the Bolivian Beauty surface palette.
 */
export function ClubStatusPill({ status }: { status: ClubProfileStatus }) {
  const published = status === "Published";
  return (
    <span
      className={cn(
        PILL,
        published
          ? "bg-accent text-primary"
          : "bg-secondary text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}

/**
 * STOR-69 Phase 2 — the dedicated 409 conflict card.
 *
 * Rendered in place of the form + sticky action bar when the latest save
 * returned `club_profile_conflict`. Two triggers in the wild: the
 * first-save race (two concurrent first PUTs for the same club account)
 * and the stale-xmin update race (someone saved after this page loaded).
 * Both come back under the same backend code and the same copy.
 *
 * The actions:
 *   - Keep editing: dismiss the conflict card, leave the unsaved buffer
 *     in place, let the user decide what to keep.
 *   - Reload latest: refetch the profile from the server, discard the
 *     unsaved buffer. Same shape as the existing load retry.
 */
export function ClubConflictCard({
  busy,
  onKeepEditing,
  onReloadLatest,
}: {
  busy: "save" | "publish" | "unpublish" | "reload" | null;
  onKeepEditing: () => void;
  onReloadLatest: () => void;
}) {
  const reloading = busy === "reload";
  return (
    <section
      role="alert"
      aria-labelledby="club-conflict-heading"
      className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2 id="club-conflict-heading" className="font-heading text-lg font-semibold text-foreground">
          This profile changed elsewhere
        </h2>
        <p className="mt-1 text-sm text-foreground">
          Someone saved this profile after you opened this page, so this save was not
          accepted. Your changes are still in the form. Reload to bring in the latest
          version, or keep editing and try saving again.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={busy !== null}
          onClick={onKeepEditing}
          className="h-10 sm:h-9"
        >
          Keep editing
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={busy !== null}
          onClick={onReloadLatest}
          className="h-10 px-4 sm:h-9"
        >
          {reloading ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          {reloading ? "Reloading…" : "Reload latest"}
        </Button>
      </div>
    </section>
  );
}

/**
 * STOR-69 Phase 2 — where the profile stands: Draft or Published, what
 * is still missing before it can be published, and the Publish or
 * Unpublish button. The checklist mirrors the server's `MissingParts`
 * rules in `ManageClubProfileHandler.MissingParts`: name, about,
 * university, member count, at least one field of study, at least one
 * study year. The mirror lives in `club-helpers.publishChecklist`.
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
  busy: "save" | "publish" | "unpublish" | "reload" | null;
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
                  <Check className="size-4 shrink-0 text-primary" aria-hidden />
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
          <Check className="size-4 shrink-0 text-primary" aria-hidden />
          Everything needed to publish is filled in.
        </p>
      )}

      {notice ? (
        <p role="status" className="text-sm font-medium text-primary">
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