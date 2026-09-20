"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

import type { ExplorationStatus, GapBand } from "@/lib/api/growth";
import {
  styleForConfidenceBand,
  styleForExplorationStatus,
  styleForTitleChip,
  styleForVersionBadge,
} from "@/lib/growth/status-style";

/**
 * STOR-40 Phase 5 — one shared pill component for every rounded status
 * indicator on the advisor surface: rail rows, title row, summary header,
 * gap bands, the compare view, and the comparison-title chips.
 *
 * Variants:
 *
 *   - `working`  → spinner + "Working…" (or "Updating…" for the summary
 *                  header). The `label` prop overrides the default text.
 *   - `failed`   → AlertTriangle + "Failed".
 *   - `version`  → no icon, "Version N" (the `label` carries the number).
 *   - `developing` → no icon, "Developing".
 *   - `missing`  → no icon, "Missing".
 *   - `chip`     → no icon, neutral title chip (compare heading).
 *
 * The raw status values from `{@link styleForExplorationStatus}` get
 * coerced into the right variant so the rail/title rows can keep
 * passing `status="Working"` and `status="Failed"` without growing
 * new variants. Hex values come from the status-style module so this
 * component never types a hex literal.
 */

export type StatusPillVariant =
  | "working"
  | "failed"
  | "version"
  | "developing"
  | "missing"
  | "chip";

interface BaseProps {
  className?: string;
  /** Override the default label. */
  label?: string;
}

interface WorkingProps extends BaseProps {
  variant: "working";
}

interface FailedProps extends BaseProps {
  variant: "failed";
}

interface VersionProps extends BaseProps {
  variant: "version";
}

interface DevelopingProps extends BaseProps {
  variant: "developing";
}

interface MissingProps extends BaseProps {
  variant: "missing";
}

interface ChipProps extends BaseProps {
  variant: "chip";
  children: React.ReactNode;
}

export type StatusPillProps =
  | WorkingProps
  | FailedProps
  | VersionProps
  | DevelopingProps
  | MissingProps
  | ChipProps;

const BASE_CLASSES =
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-xs font-semibold leading-4 whitespace-nowrap";

const ICON_PROPS = { className: "size-3", "aria-hidden": true, strokeWidth: 2 };

export function StatusPill(props: StatusPillProps) {
  switch (props.variant) {
    case "working":
      return <WorkingPill {...props} />;
    case "failed":
      return <FailedPill {...props} />;
    case "version":
      return <VersionPill {...props} />;
    case "developing":
      return <GapBandPill band="Developing" />;
    case "missing":
      return <GapBandPill band="Missing" />;
    case "chip":
      return <TitleChipPill>{props.children}</TitleChipPill>;
  }
}

function WorkingPill({ className, label = "Working…" }: WorkingProps) {
  const style = styleForExplorationStatus("Working");
  return (
    <span
      className={`${BASE_CLASSES} ${className ?? ""}`.trim()}
      style={{ background: style.background, color: style.color }}
      data-testid="status-pill-working"
    >
      <Loader2
        {...ICON_PROPS}
        className="size-3 animate-spin motion-reduce:animate-none"
      />
      {label}
    </span>
  );
}

function FailedPill({ className, label }: FailedProps) {
  const style = styleForExplorationStatus("Failed");
  return (
    <span
      className={`${BASE_CLASSES} ${className ?? ""}`.trim()}
      style={{ background: style.background, color: style.color }}
      data-testid="status-pill-failed"
    >
      <AlertTriangle {...ICON_PROPS} />
      {label ?? style.label}
    </span>
  );
}

function VersionPill({ className, label = "Version" }: VersionProps) {
  const style = styleForVersionBadge("Older");
  return (
    <span
      className={`${BASE_CLASSES} ${className ?? ""}`.trim()}
      style={{ background: style.background, color: style.color }}
      data-testid="status-pill-version"
    >
      {label}
    </span>
  );
}

function GapBandPill({ band }: { band: GapBand }) {
  const style = styleForConfidenceBand(band);
  return (
    <span
      className={BASE_CLASSES}
      style={{ background: style.background, color: style.color }}
      data-testid={`status-pill-${band.toLowerCase()}`}
    >
      {style.label}
    </span>
  );
}

function TitleChipPill({ children }: { children: React.ReactNode }) {
  const style = styleForTitleChip();
  return (
    <span
      className={BASE_CLASSES}
      style={{ background: style.background, color: style.color }}
      data-testid="status-pill-chip"
    >
      {children}
    </span>
  );
}

/**
 * Convenience constructors that map wire-shape exploration status onto
 * the variant set. The rail rows + title-row pill use these so the
 * call sites don't have to remember which variant maps to which status.
 */
export function StatusPillForStatus({
  status,
  className,
}: {
  status: ExplorationStatus;
  className?: string;
}) {
  switch (status) {
    case "Working":
      return <StatusPill variant="working" className={className} />;
    case "Failed":
      return <StatusPill variant="failed" className={className} />;
    case "Idle":
    default:
      // Idle explores carry no rail pill; call sites should already
      // avoid rendering for this case, but if they don't we render
      // nothing rather than mislabel the row.
      return null;
  }
}
