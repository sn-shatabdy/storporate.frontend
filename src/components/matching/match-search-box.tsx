import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

import { MATCH_QUERY_MAX } from "@/lib/api/matching";

/** Free text search card. The parent owns the text and the debounce. */
export function MatchSearchBox({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  const errorId = `${id}-error`;
  return (
    <div
      role="search"
      className="flex flex-col gap-1.5 rounded-2xl border bg-card p-5 shadow-sm"
      style={{ borderColor: "var(--border)" }}
    >
      <label
        htmlFor={id}
        className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          type="search"
          value={value}
          maxLength={MATCH_QUERY_MAX}
          placeholder={placeholder}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="pl-8 pr-9 [&::-webkit-search-cancel-button]:hidden"
          onChange={(e) => onChange(e.target.value)}
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onChange("")}
            className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
