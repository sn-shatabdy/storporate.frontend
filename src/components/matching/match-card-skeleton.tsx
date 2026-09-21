/** One pulsing placeholder card, shaped like a match card. */
export function MatchCardSkeleton() {
  return (
    <div
      aria-hidden
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="block size-12 shrink-0 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          <div className="flex flex-1 flex-col gap-2">
            <span className="block h-5 w-[55%] animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <span className="block h-3 w-[35%] animate-pulse rounded bg-muted motion-reduce:animate-none" />
          </div>
        </div>
        <span className="block h-6 w-20 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
      </div>
      <div className="flex flex-col gap-2">
        <span className="block h-3.5 w-[80%] animate-pulse rounded bg-muted motion-reduce:animate-none" />
        <span className="block h-3.5 w-[65%] animate-pulse rounded bg-muted motion-reduce:animate-none" />
      </div>
      <div className="flex gap-2">
        <span className="block h-5 w-16 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
        <span className="block h-5 w-20 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/** Three placeholder cards while the matches load. */
export function MatchListSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {[0, 1, 2].map((i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </div>
  );
}
