import { CalendarDays, MapPin, Users } from "lucide-react";

import {
  FREQUENCY_LABELS,
  type ClubAudience,
  type ClubEvent,
} from "@/lib/api/clubs";

import { initialsOf, pluralize, yearsText } from "./club-helpers";

/** The parts of a profile the view needs. Both the saved response and the
 *  builder's live form values fit this shape. */
export interface ClubProfileViewData {
  name: string;
  tagline: string | null;
  about: string;
  university: string;
  city: string | null;
  foundedYear: number | null;
  memberCount: number;
  audience: ClubAudience;
  events: ClubEvent[];
}

const CARD = "rounded-2xl border bg-card p-5 shadow-sm sm:p-6";
const SECTION_TITLE = "font-heading text-lg font-semibold text-foreground";
const SMALL_LABEL =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

/**
 * STOR-69 Phase 2 — one page a company can read in a minute: who the
 * club is, how big it is, who its audience is and what events it runs.
 * Used by the company detail page and by the builder's right-rail live
 * preview. Hex-free: the working-blue pills use the shared `bg-accent
 * text-primary` pair so swapping the palette theme swaps every preview
 * tile at once.
 */
export function ClubProfileView({
  profile,
  headingAs = "h1",
}: {
  profile: ClubProfileViewData;
  /** The preview sits under the builder's own h1, so it uses h2. */
  headingAs?: "h1" | "h2";
}) {
  const Heading = headingAs;
  const where = [profile.university, profile.city?.trim() || null]
    .filter(Boolean)
    .join(" · ");
  const fields = profile.audience.fieldsOfStudy;
  const years = profile.audience.years;
  const events = profile.events;

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Club summary"
        className={CARD}
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-accent font-heading text-lg font-semibold text-primary"
          >
            {initialsOf(profile.name)}
          </span>
          <div className="min-w-0 flex-1">
            <Heading className="break-words font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
              {profile.name}
            </Heading>
            {profile.tagline ? (
              <p className="mt-1 text-sm text-foreground sm:text-base">
                {profile.tagline}
              </p>
            ) : null}
            {where || profile.foundedYear ? (
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              {where ? <span>{where}</span> : null}
              {profile.foundedYear ? (
                <>
                  {where ? <span aria-hidden>·</span> : null}
                  <span>Founded {profile.foundedYear}</span>
                </>
              ) : null}
            </p>
            ) : null}
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-secondary px-4 py-3">
            <dt className={SMALL_LABEL}>Members</dt>
            <dd className="mt-1 font-heading text-2xl font-semibold text-foreground">
              {profile.memberCount.toLocaleString("en-US")}
            </dd>
          </div>
          <div className="rounded-xl bg-secondary px-4 py-3">
            <dt className={SMALL_LABEL}>Events</dt>
            <dd className="mt-1 font-heading text-2xl font-semibold text-foreground">
              {events.length}
            </dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="club-view-audience"
        className={`${CARD} flex flex-col gap-4`}
        style={{ borderColor: "var(--border)" }}
      >
        <h2 id="club-view-audience" className={SECTION_TITLE}>
          Audience
        </h2>
        <div className="flex flex-col gap-2">
          <p className={SMALL_LABEL}>Fields of study</p>
          {fields.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Fields of study">
              {fields.map((f) => (
                <li key={f}>
                  <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-[3px] text-[11.5px] font-semibold text-primary">
                    {f}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Not listed yet.</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className={SMALL_LABEL}>Study years</p>
          {years.length > 0 ? (
            <p className="text-sm text-foreground">Years: {yearsText(years)}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Not listed yet.</p>
          )}
        </div>
      </section>

      <section
        aria-labelledby="club-view-about"
        className={`${CARD} flex flex-col gap-3`}
        style={{ borderColor: "var(--border)" }}
      >
        <h2 id="club-view-about" className={SECTION_TITLE}>
          About
        </h2>
        <p className="whitespace-pre-line break-words text-sm leading-6 text-foreground">
          {profile.about}
        </p>
      </section>

      <section
        aria-labelledby="club-view-events"
        className={`${CARD} flex flex-col gap-4`}
        style={{ borderColor: "var(--border)" }}
      >
        <h2 id="club-view-events" className={SECTION_TITLE}>
          Events
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events listed yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((event, index) => (
              <li key={event.id || index}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EventCard({ event }: { event: ClubEvent }) {
  return (
    <article
      className="flex flex-col gap-3 rounded-xl border bg-background p-4"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="break-words font-heading text-base font-semibold leading-snug text-foreground">
          {event.title}
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-primary">
          <CalendarDays className="size-3" aria-hidden />
          {FREQUENCY_LABELS[event.frequency] ?? event.frequency}
        </span>
      </div>
      {event.typicalAttendance > 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="size-3.5" aria-hidden />
          Typically {pluralize(event.typicalAttendance, "person", "people")}
        </p>
      ) : null}
      {event.description ? (
        <p className="whitespace-pre-line break-words text-sm leading-6 text-foreground">
          {event.description}
        </p>
      ) : null}
      {event.supportNeeds.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className={SMALL_LABEL}>Support needed</p>
          <ul className="flex flex-wrap gap-1.5" aria-label="Support needed">
            {event.supportNeeds.map((need) => (
              <li key={need}>
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-[3px] text-[11.5px] font-medium text-foreground">
                  {need}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
