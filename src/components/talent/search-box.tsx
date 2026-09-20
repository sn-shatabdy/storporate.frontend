"use client";

import { forwardRef, type ChangeEvent, type KeyboardEvent } from "react";
import { Loader2, Search } from "lucide-react";

import { Textarea } from "@/components/ui/textarea";

import {
  counterLine,
  messageForQueryValidation,
  validateQuery,
  type QueryValidationState,
} from "./helpers";

/**
 * STOR-43 Phase 4 — the search card at the top of the employer page.
 *
 * Owns the textarea + counter + Search button only. Does NOT own the
 * submission lifecycle — the page wires `onSubmit(query)` and decides
 * what to do (call POST, surface the busy message, etc). The page
 * also passes the latest "currently searching" flag so the button
 * can switch into the spinner label.
 *
 * Inline validation is purely a function of the current query; the
 * server-side rule ("trimmed length >= 10") is mirrored exactly so a
 * user typing the 11th character gets immediate feedback instead of
 * a round-trip.
 *
 * Keyboard: Enter inserts a newline (the textarea is a textarea, not
 * a single-line input); Cmd/Ctrl+Enter submits when valid. This is
 * the standard multi-line-submit convention.
 */
export interface SearchBoxProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  /** True while a POST is in flight or while a polling loop is running.
   *  Disables the textarea, the button, and swaps the button label to
   *  "Searching…" with a spinner. */
  searching: boolean;
  /** Optional message from the POST (e.g. when the backend rejected a
   *  query that the client thought was valid). Takes precedence over
   *  the locally-computed inline message when set. */
  inlineErrorMessage?: string | null;
}

export const SearchBox = forwardRef<HTMLTextAreaElement, SearchBoxProps>(
  function SearchBox(
    { value, onChange, onSubmit, searching, inlineErrorMessage },
    ref,
  ) {
    const validation: QueryValidationState = validateQuery(value);
    const localMessage = messageForQueryValidation(validation);
    // Post-validation message (when set) wins over the local one so
    // a server-side rejection stays visible even if the user has
    // since re-typed into a locally-valid value. The page clears
    // `inlineErrorMessage` as soon as the user types again.
    const inlineMessage = inlineErrorMessage ?? localMessage;
    const isInvalid = inlineMessage !== null;
    const canSubmit = validation.kind === "valid" && !searching;

    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(event.target.value);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter submits when valid. Plain Enter keeps the
      // textarea's native newline behavior.
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (canSubmit) {
          onSubmit();
        }
      }
    };

    const inlineMessageId = inlineMessage ? "talent-search-error" : undefined;

    return (
      <section
        className="flex flex-col gap-3.5 border bg-card p-5 shadow-sm sm:p-6"
        style={{ borderRadius: 16, borderColor: "var(--border)" }}
      >
        <label
          htmlFor="talent-search-query"
          className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Who are you looking for
        </label>
        <Textarea
          id="talent-search-query"
          ref={ref}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={3}
          maxLength={1000}
          disabled={searching}
          aria-invalid={isInvalid}
          aria-describedby={inlineMessageId}
          placeholder="e.g. Someone who can build data dashboards in Power BI and clean messy sales data"
        />
        {inlineMessage && (
          <p
            id={inlineMessageId}
            className="text-xs font-medium text-[#b3261e]"
          >
            {inlineMessage}
          </p>
        )}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">{counterLine(value)}</p>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            aria-label={searching ? "Searching" : "Search"}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[10px] border px-4 text-sm font-semibold text-white transition-opacity disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            style={{ backgroundColor: "#4d7ea0", borderColor: "#4d7ea0" }}
          >
            {searching ? (
              <>
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden
                />
                Searching…
              </>
            ) : (
              <>
                <Search className="size-4" aria-hidden />
                Search
              </>
            )}
          </button>
        </div>
      </section>
    );
  },
);
