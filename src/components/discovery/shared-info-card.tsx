import { offStateFooterLine } from "./helpers";

/**
 * STOR-43 Phase 3 — the off-state "What employers would see" card. Always
 * shown while the master switch is OFF; replaced by the details form +
 * preview when the master switch flips ON. The two columns use a 1-col
 * grid on phones so they stack without horizontal scroll.
 */
export interface SharedInfoCardProps {
  visibleItemCount: number;
}

export function SharedInfoCard({ visibleItemCount }: SharedInfoCardProps) {
  return (
    <section
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-6"
      style={{ borderColor: "var(--border)" }}
    >
      <h2 className="font-heading text-lg font-semibold text-foreground">
        What employers would see
      </h2>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Shared when on
          </p>
          <ul className="mt-2 list-disc pl-[18px] text-sm leading-[1.7] text-foreground">
            <li>Your display name</li>
            <li>The details you choose to show</li>
            <li>Portfolio item titles and categories</li>
            <li>Skills and their Strong or Developing level</li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Never shared
          </p>
          <ul className="mt-2 list-disc pl-[18px] text-sm leading-[1.7] text-foreground">
            <li>Your email address</li>
            <li>Your files and links</li>
            <li>Your item descriptions</li>
          </ul>
        </div>
      </div>

      <p
        className="border-t pt-3.5 text-[13px] text-muted-foreground"
        style={{ borderColor: "var(--border)" }}
      >
        {offStateFooterLine(visibleItemCount)}
      </p>
    </section>
  );
}
