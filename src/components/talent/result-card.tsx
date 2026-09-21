"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CandidateActions } from "@/components/outreach/candidate-actions";
import type { TalentSearchResultItem } from "@/lib/api/talentSearch";

import { CitedItemList } from "./cited-item-list";
import {
  composeDetailLine,
  initialsFor,
} from "./helpers";
import { SkillBandPill } from "./skill-band-pill";

/**
 * STOR-43 Phase 4 + STOR-44 Phase 4 — a single candidate in the
 * search results.
 *
 * Layout (per the approved design):
 *   - Row 1: initials tile + name (Space Grotesk, 17px, semibold) +
 *     optional headline (muted).
 *   - Row 2: only when at least one of university / fieldOfStudy /
 *     studyYear is present. Parts joined by " · " in the agreed
 *     order, followed by the "Self-reported" pill.
 *   - Row 3: the plain-language reason.
 *   - Row 4: matched-skills pills (only when there are any).
 *   - Row 5: cited items, only when there are any.
 *   - Row 6 (STOR-44, STOR-68): "Save to shortlist", "Invite" and the "View portfolio" link to
 *     `/employer/candidates/{candidateId}` — wraps a Next `<Link>`
 *     styled as an outline button. Right-aligned with a top border.
 */
export interface ResultCardProps {
  result: TalentSearchResultItem;
}

export function ResultCard({ result }: ResultCardProps) {
  const detailLine = composeDetailLine({
    university: result.university,
    fieldOfStudy: result.fieldOfStudy,
    studyYear: result.studyYear,
  });
  const hasHeadline =
    result.headline !== null && result.headline.trim().length > 0;
  const hasMatchedSkills = result.matchedSkills.length > 0;
  const hasCitedItems = result.citedItems.length > 0;

  return (
    <li
      className="flex flex-col gap-3.5 border bg-card p-[22px] shadow-sm"
      style={{ borderRadius: 16, borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-[11px] bg-accent text-primary font-heading text-base font-semibold"
        >
          {initialsFor(result.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="break-words font-heading text-[17px] font-semibold text-foreground">
            {result.displayName}
          </p>
          {hasHeadline && (
            <p className="break-words text-[13px] text-muted-foreground">
              {result.headline}
            </p>
          )}
        </div>
      </div>

      {detailLine.hasAnyShownPart && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
          {detailLine.parts.map((part, idx) => (
            <span key={`${part}-${idx}`} className="break-words">
              {part}
            </span>
          ))}
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-foreground"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            Self-reported
          </span>
        </div>
      )}

      <p className="break-words text-sm leading-relaxed text-foreground">
        {result.reason}
      </p>

      {hasMatchedSkills && (
        <div className="flex flex-wrap gap-2">
          {result.matchedSkills.map((skill) => (
            <SkillBandPill
              key={`${skill.name}-${skill.band}`}
              name={skill.name}
              band={skill.band}
              size="card"
            />
          ))}
        </div>
      )}

      {hasCitedItems && <CitedItemList items={result.citedItems} />}

      <div
        className="border-t pt-3.5"
        style={{ borderColor: "var(--border)" }}
      >
        <CandidateActions
          candidateId={result.candidateId}
          displayName={result.displayName}
        >
          <Link
            href={`/employer/candidates/${result.candidateId}`}
            className="inline-flex h-9 items-center gap-2 rounded-[10px] border bg-white px-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            style={{ borderColor: "#e7dfc0" }}
          >
            View portfolio
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </CandidateActions>
      </div>
    </li>
  );
}
