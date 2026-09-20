"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
} from "lucide-react";

import type {
  ExplorationDetail,
  ExplorationGap,
  ExplorationSuggestion,
  ExplorationSummary,
} from "@/lib/api/growth";
import { formatSummaryTime } from "@/lib/growth/format-time";

import { StatusPill } from "./status-pill";

/**
 * STOR-40 Phase 5 — the summary panel extracted from
 * `advisor-detail.tsx` so the layout file stays focused on orchestration.
 *
 * Four visible states, derived from `detail.latestSummary` and the
 * parent's `isWorking` flag:
 *
 *   1. Empty (no summary yet)        → dashed "No summary yet" card.
 *   2. Updating (working + summary)   → "Updating…" pill in the header
 *                                        (the dashed updating box from
 *                                        Phase 4 was removed).
 *   3. Stable (summary present)       → header pill "Version N" + change
 *                                        note + Gaps + Suggestions cards.
 *   4. Stable without summary         → nothing (the parent should not
 *                                        render this panel in that case).
 */

interface SummaryPanelProps {
  detail: ExplorationDetail;
  isWorking: boolean;
}

export function SummaryPanel({ detail, isWorking }: SummaryPanelProps) {
  const summary = detail.latestSummary;
  const showUpdating = isWorking && summary !== null;
  const showEmpty = summary === null;

  return (
    <aside
      aria-label="Exploration summary"
      className="flex flex-col gap-4 rounded-2xl border border-[#e7dfc0] bg-white p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-lg font-semibold leading-tight text-foreground">
          Summary
        </h3>
        {summary ? (
          <StatusPill
            variant={showUpdating ? "working" : "version"}
            label={showUpdating ? "Updating…" : `Version ${summary.versionNumber}`}
          />
        ) : null}
      </div>

      {summary && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Updated {formatSummaryTime(summary.createdAt)}
        </p>
      )}

      {summary?.changeNote && <ChangeNoteBanner text={summary.changeNote} />}

      {showEmpty && <EmptySummary />}

      {summary && summary.gaps.length > 0 && (
        <Section
          title="Gaps"
          count={summary.gaps.length}
          items={summary.gaps.map((g, i) => ({
            key: `${i}-${g.title}-${g.band ?? "none"}`,
            node: <GapRow gap={g} />,
          }))}
        />
      )}

      {summary && summary.suggestions.length > 0 && (
        <Section
          title="Suggestions"
          count={summary.suggestions.length}
          items={summary.suggestions.map((s, i) => ({
            key: `${i}-${s.title}`,
            node: <SuggestionRow suggestion={s} index={i + 1} />,
          }))}
        />
      )}
    </aside>
  );
}

interface SectionProps {
  title: string;
  count: number;
  items: Array<{ key: string; node: React.ReactNode }>;
}

/** Heading row (title + count) + items container, with each card
 * owning its own padding so a card can be inspected independently. */
export function Section({ title, count, items }: SectionProps) {
  return (
    <section className="flex flex-col gap-2.5" aria-label={title}>
      <div className="flex items-baseline justify-between">
        <h4 className="font-heading text-[15px] font-semibold leading-tight text-foreground">
          {title}
        </h4>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <div key={item.key}>{item.node}</div>
        ))}
      </div>
    </section>
  );
}

function GapRow({ gap }: { gap: ExplorationGap }) {
  const band = gap.band ?? null;
  return (
    <div className="flex flex-col gap-2 rounded-[14px] border border-[#e7dfc0] bg-white p-3.5">
      <div className="flex items-center justify-between gap-2.5">
        <span className="font-heading text-[15px] font-semibold leading-tight text-foreground">
          {gap.title}
        </span>
        {band === "Developing" && <StatusPill variant="developing" />}
        {band === "Missing" && <StatusPill variant="missing" />}
      </div>
      <p className="text-[13px] leading-[1.55] text-muted-foreground">
        {gap.detail}
      </p>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  index,
}: {
  suggestion: ExplorationSuggestion;
  index: number;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-[#e7dfc0] bg-white p-3.5">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[#e7f0ed] text-xs font-bold text-[#345a73]"
        >
          {index}
        </span>
        <span className="font-heading text-[15px] font-semibold leading-[1.35] text-foreground">
          {suggestion.title}
        </span>
      </div>
      <p className="text-[13px] leading-[1.55] text-muted-foreground">
        {suggestion.reason}
      </p>
      <div className="flex items-start gap-2 rounded-[10px] bg-[#f3efdd] p-2.5">
        <ArrowRight
          className="size-3.5 shrink-0 text-[#345a73]"
          strokeWidth={2}
          aria-hidden
        />
        <p className="text-[13px] leading-normal text-foreground">
          <span className="font-bold">Next step. </span>
          {suggestion.nextStep}
        </p>
      </div>
      {suggestion.source && (
        <a
          href={suggestion.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[12px] font-semibold hover:underline"
          style={{ color: "#345a73" }}
        >
          {suggestion.source.sourceName}: {suggestion.source.title}
          <ArrowUpRight className="size-3" aria-hidden />
        </a>
      )}
    </div>
  );
}

function ChangeNoteBanner({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-[#e7f0ed] p-3">
      <Check
        className="size-[15px] shrink-0 text-[#1e7b34]"
        strokeWidth={2.2}
        aria-hidden
      />
      <p className="text-[13px] leading-normal text-foreground">{text}</p>
    </div>
  );
}

function EmptySummary() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#e7dfc0] bg-transparent px-6 py-8 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-[#e7f0ed] text-[#4d7ea0]"
      >
        <FileText className="size-[22px]" strokeWidth={1.8} aria-hidden />
      </span>
      <h4 className="font-heading text-base font-semibold text-foreground">
        No summary yet
      </h4>
      <p className="max-w-[260px] text-[13px] text-muted-foreground">
        Answer the questions. Your gaps and suggestions appear here.
      </p>
    </div>
  );
}

// Re-export for tests that want to render pieces in isolation.
export { ChangeNoteBanner, EmptySummary, GapRow, SuggestionRow };
export type { SummaryPanelProps, ExplorationSummary };
