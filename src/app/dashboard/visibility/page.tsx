"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { ApiError } from "@/lib/api/errors";
import {
  getSearchableProfile,
  updateSearchableProfile,
  type SearchableProfile,
} from "@/lib/api/discovery";

import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { ProfileDetailsForm } from "@/components/discovery/profile-details-form";
import { ProfilePreviewCard } from "@/components/discovery/profile-preview-card";
import { SaveRow } from "@/components/discovery/save-row";
import { SharedInfoCard } from "@/components/discovery/shared-info-card";
import { VisibilityToggleCard } from "@/components/discovery/visibility-toggle-card";
import {
  draftFromProfile,
  errorCodeToField,
  isDraftDirty,
  messageForStudyYearRangeError,
  requestFromDraft,
  validateDraft,
  type DiscoveryFieldError,
  type ProfileDraft,
} from "@/components/discovery/helpers";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; profile: SearchableProfile }
  | { status: "error" };

/**
 * STOR-43 Phase 3 — `/dashboard/visibility`. The student-facing opt-in
 * page. Lets a student turn on "Let employers find me" and choose which
 * profile details employers see.
 *
 * Data flow:
 *   - On mount (and whenever `loadVersion` is bumped via the "Try again"
 *     button or after a successful save), fetch the saved profile and
 *     seed the local `draft` from it.
 *   - Every input edit updates `draft` only — nothing is sent until the
 *     student clicks Save. `isDraftDirty(draft, saved)` gates the Save
 *     button and drives the right-hand status line.
 *   - On Save: validate locally first (errors short-circuit before any
 *     request), then PUT. Backend errorCodes map to field-level error
 *     IDs via `errorCodeToField`; unknown codes / network errors fall
 *     back to the form-level "Could not save your changes" alert.
 *
 * Layout states:
 *   - Master switch OFF → VisibilityToggleCard + SharedInfoCard + SaveRow.
 *   - Master switch ON  → VisibilityToggleCard + ProfileDetailsForm +
 *                          ProfilePreviewCard + SaveRow.
 * The details form and preview share the same draft, so flipping a Show
 * switch updates the preview immediately.
 */
export default function VisibilityPageRoute() {
  return <VisibilityPageShell />;
}

function VisibilityPageShell() {
  const { data: session, status: sessionStatus } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [loadVersion, setLoadVersion] = useState(0);
  const [savedProfile, setSavedProfile] = useState<SearchableProfile | null>(
    null,
  );
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof ProfileDraft, DiscoveryFieldError>>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  // Ref on the display-name input so a failed client validation can
  // move focus there (and so a backend `display_name_*` error can do
  // the same once we wire focus on a backend failure too — currently
  // we focus on client validation only, but the ref is preserved).
  const displayNameRef = useRef<HTMLInputElement>(null);

  // ------------------------------------------------------------------
  // Load
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    const tokenAtMount = accessToken;
    (async () => {
      setLoadState({ status: "loading" });
      try {
        const profile = await getSearchableProfile(
          tokenAtMount,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setSavedProfile(profile);
        setDraft(draftFromProfile(profile));
        setLoadState({ status: "ready", profile });
        // A fresh load clears any stale form-level / field-level errors.
        setFieldErrors({});
        setFormError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 403) {
          // Non-Student — the dashboard layout guard already redirects,
          // but if a stray render reaches here, render an error rather
          // than a blank form.
          setLoadState({ status: "error" });
          return;
        }
        setLoadState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [accessToken, loadVersion]);

  // ------------------------------------------------------------------
  // Top-level render gates — loading / auth-wait / load error.
  // ------------------------------------------------------------------
  if (sessionStatus === "loading" || !session) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">
          Loading your visibility settings…
        </p>
      </div>
    );
  }

  if (loadState.status === "error") {
    return (
      <div className="px-4 py-10 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Employer visibility
          </h1>
          <AdvisorErrorState
            title="Could not load your visibility settings"
            message="Check your connection and try again."
            onRetry={() => setLoadVersion((v) => v + 1)}
          />
        </div>
      </div>
    );
  }

  if (loadState.status === "loading" || !draft || !savedProfile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">
          Loading your visibility settings…
        </p>
      </div>
    );
  }

  return (
    <VisibilityReadyShell
      accessToken={accessToken ?? ""}
      draft={draft}
      setDraft={setDraft}
      savedProfile={savedProfile}
      setSavedProfile={setSavedProfile}
      fieldErrors={fieldErrors}
      setFieldErrors={setFieldErrors}
      formError={formError}
      setFormError={setFormError}
      saving={saving}
      setSaving={setSaving}
      savedOnce={savedOnce}
      setSavedOnce={setSavedOnce}
      displayNameRef={displayNameRef}
    />
  );
}

interface VisibilityReadyShellProps {
  accessToken: string;
  draft: ProfileDraft;
  setDraft: React.Dispatch<React.SetStateAction<ProfileDraft | null>>;
  savedProfile: SearchableProfile;
  setSavedProfile: React.Dispatch<React.SetStateAction<SearchableProfile | null>>;
  fieldErrors: Partial<Record<keyof ProfileDraft, DiscoveryFieldError>>;
  setFieldErrors: React.Dispatch<
    React.SetStateAction<Partial<Record<keyof ProfileDraft, DiscoveryFieldError>>>
  >;
  formError: string | null;
  setFormError: React.Dispatch<React.SetStateAction<string | null>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  savedOnce: boolean;
  setSavedOnce: React.Dispatch<React.SetStateAction<boolean>>;
  displayNameRef: React.RefObject<HTMLInputElement | null>;
}

function VisibilityReadyShell({
  accessToken,
  draft,
  setDraft,
  savedProfile,
  setSavedProfile,
  fieldErrors,
  setFieldErrors,
  formError,
  setFormError,
  saving,
  setSaving,
  savedOnce,
  setSavedOnce,
  displayNameRef,
}: VisibilityReadyShellProps) {
  const dirty = isDraftDirty(draft, savedProfile);

  const update = useCallback(
    (patch: Partial<ProfileDraft>) => {
      setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [setDraft],
  );

  const handleSave = useCallback(async () => {
    setFormError(null);
    // Only the on-state requires a display name; clear errors first.
    const errors = validateDraft(draft, {
      requireDisplayName: draft.isSearchable,
    });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Focus the display name so keyboard users land on the error.
      if (errors.displayName) {
        displayNameRef.current?.focus();
      }
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const next = await updateSearchableProfile(
        accessToken,
        requestFromDraft(draft),
      );
      setSavedProfile(next);
      setDraft(draftFromProfile(next));
      // Replace errors with whatever the page already had — none.
      setFieldErrors({});
      setFormError(null);
      setSavedOnce(true);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.errorCode === "study_year_out_of_range") {
          setFormError(messageForStudyYearRangeError());
          return;
        }
        const mapped = errorCodeToField(error.errorCode);
        if (mapped) {
          setFieldErrors({ [mapped.field]: mapped.code } as Partial<
            Record<keyof ProfileDraft, DiscoveryFieldError>
          >);
          if (mapped.field === "displayName") {
            displayNameRef.current?.focus();
          }
          return;
        }
      }
      setFormError("Could not save your changes. Try again.");
    } finally {
      setSaving(false);
    }
  }, [
    accessToken,
    displayNameRef,
    draft,
    setDraft,
    setFieldErrors,
    setFormError,
    setSavedProfile,
    setSavedOnce,
    setSaving,
  ]);

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-8">
        <header>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Employer visibility
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Choose whether employers can find you in their searches.
          </p>
        </header>

        <VisibilityToggleCard
          isSearchable={draft.isSearchable}
          visibleItemCount={savedProfile.visibleItemCount}
          disabled={saving}
          onCheckedChange={(next) => update({ isSearchable: next })}
        />

        {draft.isSearchable ? (
          <>
            <ProfileDetailsForm
              ref={displayNameRef}
              draft={draft}
              errors={fieldErrors}
              onDisplayNameChange={(next) => {
                update({ displayName: next });
                // Clear the display-name error as the student types so
                // the message doesn't linger once the field is fixed.
                if (fieldErrors.displayName) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.displayName;
                    return next;
                  });
                }
              }}
              onHeadlineChange={(next) => {
                update({ headline: next });
                if (fieldErrors.headline) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.headline;
                    return next;
                  });
                }
              }}
              onUniversityChange={(next) => {
                update({ university: next });
                if (fieldErrors.university) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.university;
                    return next;
                  });
                }
              }}
              onFieldOfStudyChange={(next) => {
                update({ fieldOfStudy: next });
                if (fieldErrors.fieldOfStudy) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.fieldOfStudy;
                    return next;
                  });
                }
              }}
              onStudyYearChange={(next) => update({ studyYear: next })}
              onShowHeadlineChange={(next) => update({ showHeadline: next })}
              onShowUniversityChange={(next) =>
                update({ showUniversity: next })
              }
              onShowFieldOfStudyChange={(next) =>
                update({ showFieldOfStudy: next })
              }
              onShowStudyYearChange={(next) =>
                update({ showStudyYear: next })
              }
            />
            <ProfilePreviewCard
              draft={draft}
              visibleItemCount={savedProfile.visibleItemCount}
            />
          </>
        ) : (
          <SharedInfoCard visibleItemCount={savedProfile.visibleItemCount} />
        )}

        <SaveRow
          dirty={dirty}
          saving={saving}
          savedOnce={savedOnce}
          formError={formError}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
