"use client";

import { FileText } from "lucide-react";

import type { TalentSearchCitedItem } from "@/lib/api/talentSearch";

import { SkillBandPill } from "./skill-band-pill";

/**
 * STOR-43 Phase 4 — the "From their portfolio" block at the bottom of a
 * result card. Renders the cited portfolio items in the order the
 * backend returned them, each as a flex row with:
 *   - a small icon tile (FileText on the accent background),
 *   - the item label,
 *   - a category pill, and
 *   - an inline skill-band pill for the cited skill.
 *
 * Hidden entirely when the list is empty (the page also hides the
 * whole block in that case — this component is rendered only when at
 * least one citation is present).
 */
export interface CitedItemListProps {
  items: TalentSearchCitedItem[];
}

export function CitedItemList({ items }: CitedItemListProps) {
  return (
    <div className="flex flex-col gap-2.5 border-t pt-3.5" style={{ borderColor: "var(--border)" }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        From their portfolio
      </p>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li
            key={item.portfolioItemId}
            className="flex flex-wrap items-center gap-2.5"
          >
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-accent text-primary"
            >
              <FileText className="size-[15px]" aria-hidden />
            </span>
            <span className="flex-1 min-w-0 break-words text-sm font-semibold text-foreground">
              {item.label}
            </span>
            <span
              className="inline-flex items-center rounded-full px-[9px] py-[3px] text-[11px] font-semibold text-foreground"
              style={{ backgroundColor: "var(--accent)" }}
            >
              {item.category}
            </span>
            <SkillBandPill
              name={item.skillName}
              band={item.band}
              size="inline"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
