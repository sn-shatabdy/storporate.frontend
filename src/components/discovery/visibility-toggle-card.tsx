"use client";

import { Eye } from "lucide-react";

import { Switch } from "@/components/ui/switch";

import { masterStatusLine } from "./helpers";

/**
 * STOR-43 Phase 3 — top card with the master "let employers find me"
 * switch. Always shown. The status line reflects the DRAFT state of the
 * switch so toggling it updates the line immediately. The switch's
 * accessible name is "Let employers find me" so a screen-reader user
 * hears the same label regardless of context.
 */
export interface VisibilityToggleCardProps {
  isSearchable: boolean;
  visibleItemCount: number;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
}

export function VisibilityToggleCard({
  isSearchable,
  visibleItemCount,
  disabled,
  onCheckedChange,
}: VisibilityToggleCardProps) {
  return (
    <section
      className="flex items-center gap-5 border bg-card p-5 shadow-sm sm:p-6"
      style={{
        borderRadius: 20,
        borderColor: "var(--border)",
        boxShadow: "0 1px 2px rgba(42,24,48,0.06)",
      }}
    >
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary"
      >
        <Eye className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Let employers find me
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {masterStatusLine(isSearchable, visibleItemCount)}
        </p>
      </div>
      <Switch
        checked={isSearchable}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label="Let employers find me"
      />
    </section>
  );
}
