"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, Loader2 } from "lucide-react";

import {
  getMyClubProfile,
  publishClubProfile,
  saveClubProfile,
  unpublishClubProfile,
  type ClubProfileResponse,
} from "@/lib/api/clubs";
import { AdvisorErrorState } from "@/components/advisor/advisor-error-state";
import { Button } from "@/components/ui/button";
import { JobsListSkeleton } from "@/components/jobs/job-states";
import { SegmentedControl } from "@/components/jobs/segmented-control";
import { ClubForm } from "@/components/clubs/club-form";
import {
  addFieldsOfStudy,
  EMPTY_CLUB_VALUES,
  errorOrder,
  messageForClubError,
  publishChecklist,
  requestFromValues,
  snapshotOf,
  validateClub,
  valuesFromProfile,
  type ClubFormValues,
} from "@/components/clubs/club-helpers";
import {
  ClubProfileView,
  type ClubProfileViewData,
} from "@/components/clubs/club-profile-view";
import { ClubStatusPanel } from "@/components/clubs/club-status-panel";

type Mode = "edit" | "preview";
type Busy = "save" | "publish" | "unpublish" | null;
type LoadState = "loading" | "ready" | "error";

function wholeNumber(raw: string): number | null {
  const t = raw.trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

/** What companies would see, built from the live form values. */
function previewFromValues(v: ClubFormValues): ClubProfileViewData {
  const city = v.city.trim();
  const tagline = v.tagline.trim();
  return {
    name: v.name.trim() || "Your club name",
    tagline: tagline || null,
    about: v.about.trim() || "Your description will appear here.",
    university: v.university.trim(),
    city: city || null,
    foundedYear: wholeNumber(v.foundedYear),
    memberCount: wholeNumber(v.memberCount) ?? 0,
    audience: { fieldsOfStudy: v.fieldsOfStudy, years: v.years },
    events: v.events.map((e) => ({
      id: e.key,
      title: e.title.trim() || "Untitled event",
      description: e.description.trim() || null,
      typicalAttendance: wholeNumber(e.typicalAttendance) ?? 0,
      frequency: e.frequency,
      supportNeeds: e.supportNeeds,
    })),
  };
}

/** `/club/profile`: the club's profile builder. The (club) layout owns the
 *  authorization gate. */
export default function ClubProfilePage() {
  const { data: session } = useSession();
  const accessToken = session?.accessToken ?? null;

  const [load, setLoad] = useState<LoadState>("loading");
  const [version, setVersion] = useState(0);
  const [profile, setProfile] = useState<ClubProfileResponse | null>(null);
  const [values, setValues] = useState<ClubFormValues>(EMPTY_CLUB_VALUES);
  const [savedSnapshot, setSavedSnapshot] = useState(() => snapshotOf(EMPTY_CLUB_VALUES));
  const [fieldDraft, setFieldDraft] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("edit");
  const focusIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    (async () => {
      setLoad("loading");
      try {
        const existing = await getMyClubProfile(accessToken, controller.signal);
        if (controller.signal.aborted) return;
        const next = existing ? valuesFromProfile(existing) : EMPTY_CLUB_VALUES;
        setProfile(existing);
        setValues(next);
        setSavedSnapshot(snapshotOf(next));
        setLoad("ready");
      } catch {
        if (controller.signal.aborted) return;
        setLoad("error");
      }
    })();
    return () => controller.abort();
  }, [accessToken, version]);

  const dirty = useMemo(
    () => snapshotOf(values) !== savedSnapshot || fieldDraft.trim() !== "",
    [values, savedSnapshot, fieldDraft],
  );
  const checklist = useMemo(() => publishChecklist(values), [values]);
  const status = profile?.status ?? "Draft";

  const handleChange = useCallback((next: ClubFormValues) => {
    setValues(next);
    setJustSaved(false);
    setNotice(null);
  }, []);

  // Focus waits until the fields are enabled and the edit view is showing.
  useEffect(() => {
    const id = focusIdRef.current;
    if (!id || busy !== null || mode !== "edit") return;
    document.getElementById(id)?.focus();
    focusIdRef.current = null;
  }, [errors, busy, mode]);

  /** Validate and save. Returns the saved profile, or null when it did not save. */
  async function persist(): Promise<ClubProfileResponse | null> {
    if (!accessToken) return null;
    setFormError(null);

    // Take a half typed field of study along with the save.
    const merged = fieldDraft.trim()
      ? addFieldsOfStudy(values.fieldsOfStudy, fieldDraft).skills
      : values.fieldsOfStudy;
    const finalValues = { ...values, fieldsOfStudy: merged };

    const found = validateClub(finalValues, new Date().getFullYear());
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = errorOrder(finalValues).find((id) => found[id]);
      setValues(finalValues);
      setMode("edit");
      focusIdRef.current = first ?? null;
      return null;
    }

    try {
      const saved = await saveClubProfile(accessToken, requestFromValues(finalValues));
      const next = valuesFromProfile(saved);
      setProfile(saved);
      setValues(next);
      setSavedSnapshot(snapshotOf(next));
      setFieldDraft("");
      setJustSaved(true);
      return saved;
    } catch (error) {
      setValues(finalValues);
      setFormError(messageForClubError(error, "save"));
      return null;
    }
  }

  async function run(kind: Exclude<Busy, null>, work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(kind);
    setNotice(null);
    try {
      await work();
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!dirty) return;
    void run("save", async () => {
      await persist();
    });
  }

  function handlePublish() {
    if (!accessToken) return;
    void run("publish", async () => {
      if (dirty) {
        const saved = await persist();
        if (!saved) return;
      } else {
        setFormError(null);
      }
      try {
        const published = await publishClubProfile(accessToken);
        setProfile(published);
        setJustSaved(false);
        setNotice("Your profile is published.");
      } catch (error) {
        setFormError(messageForClubError(error, "publish"));
      }
    });
  }

  function handleUnpublish() {
    if (!accessToken) return;
    void run("unpublish", async () => {
      setFormError(null);
      try {
        const unpublished = await unpublishClubProfile(accessToken);
        setProfile(unpublished);
        setNotice("Your profile is unpublished.");
      } catch (error) {
        setFormError(messageForClubError(error, "unpublish"));
      }
    });
  }

  const statusLine =
    busy === "save"
      ? "Saving…"
      : dirty
        ? "You have unsaved changes."
        : justSaved
          ? "Saved."
          : "";

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Your club profile
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            A page companies can read in one minute.
          </p>
        </div>

        {load === "loading" ? (
          <JobsListSkeleton label="Loading your club profile." />
        ) : load === "error" ? (
          <AdvisorErrorState
            title="Could not load your club profile"
            message="Check your connection and try again."
            onRetry={() => setVersion((v) => v + 1)}
          />
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-[14px] border bg-[#fbe9e7] p-4 text-sm text-foreground"
                style={{ borderColor: "rgba(179,38,30,0.25)" }}
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#b3261e]" aria-hidden />
                <span>{formError}</span>
              </div>
            ) : null}

            <ClubStatusPanel
              status={status}
              checklist={checklist}
              busy={busy}
              notice={notice}
              onPublish={handlePublish}
              onUnpublish={handleUnpublish}
            />

            <div className="flex flex-col gap-1.5">
              <span className="sr-only">View</span>
              <SegmentedControl<Mode>
                name="club-mode"
                legend="View"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "edit", label: "Edit" },
                  { value: "preview", label: "Preview" },
                ]}
              />
            </div>

            {mode === "edit" ? (
              <ClubForm
                values={values}
                errors={errors}
                disabled={busy !== null}
                fieldDraft={fieldDraft}
                onFieldDraftChange={setFieldDraft}
                onChange={handleChange}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  This is how companies see your profile.
                </p>
                <ClubProfileView profile={previewFromValues(values)} headingAs="h2" />
              </div>
            )}

            <div
              className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-md backdrop-blur"
              style={{ borderColor: "var(--border)" }}
            >
              <p role="status" aria-live="polite" className="min-w-0 flex-1 px-1 text-sm text-muted-foreground">
                {statusLine}
              </p>
              <Button
                type="submit"
                size="lg"
                disabled={!dirty || busy !== null}
                className="h-10 px-5 sm:h-9"
              >
                {busy === "save" ? (
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                ) : null}
                Save
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
