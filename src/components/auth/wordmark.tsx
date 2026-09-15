/** The 34px rounded-square "S" mark + "Storporate" wordmark used on auth screens. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <span
        aria-hidden
        className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] font-heading-auth text-base font-bold text-[var(--auth-accent-text,white)]"
        style={{ backgroundColor: "var(--auth-accent, #4D7EA0)" }}
      >
        S
      </span>
      <span
        className="font-heading-auth text-lg font-semibold text-[var(--auth-text-primary,#111)]"
      >
        Storporate
      </span>
    </div>
  );
}
