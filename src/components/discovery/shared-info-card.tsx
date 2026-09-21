import { offStateFooterLine } from "./helpers";

/**
 * STOR-43 Phase 3 — the off-state "What employers would see" card. Always
 * shown while the master switch is OFF; replaced by the details form +
 * preview when the master switch flips ON. The two columns use a 1-col
 * grid on phones so they stack without horizontal scroll.
 *
 * STOR-44 Phase 3 — column two now carries two mini-headings instead of
 * one: "Shared only if you choose" (which surfaces the per-item sharing
 * flag introduced this phase) and "Never shared" (the strict-no list).
 * The "Your files and links" bullet moved out of "Never shared" because
 * files/links ARE shareable now, just item-by-item. The "Your email
 * address" + "Your item descriptions" bullets stay — those are still
 * strictly off-limits regardless of any per-item toggle. The footer
 * paragraph beneath the columns gained a short sentence pointing the
 * student at the per-item toggle so they know it's not part of the
 * master "let employers find me" switch.
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
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Shared only if you choose
            </p>
            <ul className="mt-2 list-disc pl-[18px] text-sm leading-[1.7] text-foreground">
              <li>Original files and links, item by item</li>
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Never shared
            </p>
            <ul className="mt-2 list-disc pl-[18px] text-sm leading-[1.7] text-foreground">
              <li>Your email address</li>
              <li>Your item descriptions</li>
            </ul>
          </div>
        </div>
      </div>

      <p
        className="border-t pt-3.5 text-[13px] text-muted-foreground"
        style={{ borderColor: "var(--border)" }}
      >
        You can also let employers open the original file or link of an
        item. Choose this item by item in your portfolio.
      </p>

      <p
        className="border-t pt-3.5 text-[13px] text-muted-foreground"
        style={{ borderColor: "var(--border)" }}
      >
        {offStateFooterLine(visibleItemCount)}
      </p>
    </section>
  );
}
