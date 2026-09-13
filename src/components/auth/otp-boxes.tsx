"use client";

import { useEffect, useRef } from "react";

const LENGTH = 6;
// Placeholder for an empty box within the fixed-length `value` string. A
// plain `""` per-slot cannot round-trip through `Array.join("")` — joining
// ["", "9", "9"] collapses to "99", silently shifting every later digit left
// and losing which specific box was cleared. `EMPTY_CODE` (all placeholders)
// is the canonical "nothing entered yet" value.
const EMPTY_SLOT = "_";
export const EMPTY_CODE = EMPTY_SLOT.repeat(LENGTH);

interface OtpBoxesProps {
  value: string;
  onChange: (value: string) => void;
  hasError: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  label: string;
}

/** True once every box holds a real digit — use instead of `value.length`. */
export function isOtpCodeComplete(value: string): boolean {
  return value.length === LENGTH && !value.includes(EMPTY_SLOT);
}

/**
 * Six individually-boxed digit inputs: auto-advance on type, backspace
 * clears-and-moves-back, and pasting a full code fills every box at once.
 * `value` is always a fixed `LENGTH`-character string (see `EMPTY_CODE`) —
 * the single source of truth — so the parent step component can reset it
 * (e.g. on a new resend) without this component holding divergent internal
 * state.
 */
export function OtpBoxes({ value, onChange, hasError, disabled, autoFocus, label }: OtpBoxesProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? EMPTY_SLOT);

  useEffect(() => {
    if (autoFocus) inputRefs.current[0]?.focus();
  }, [autoFocus]);

  function commit(next: string[]) {
    onChange(next.join(""));
  }

  function handleChange(index: number, raw: string) {
    const onlyDigits = raw.replace(/\D/g, "");
    if (onlyDigits.length === 0) {
      const next = digits.slice();
      next[index] = EMPTY_SLOT;
      commit(next);
      return;
    }
    if (onlyDigits.length > 1) {
      // A full (or partial) code landed in one box — e.g. autofill or a
      // paste that didn't trigger onPaste. Distribute it from this index.
      const next = digits.slice();
      for (let i = 0; i < onlyDigits.length && index + i < LENGTH; i++) {
        next[index + i] = onlyDigits[i];
      }
      commit(next);
      const nextIndex = Math.min(index + onlyDigits.length, LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const next = digits.slice();
    next[index] = onlyDigits;
    commit(next);
    if (index < LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (digits[index] !== EMPTY_SLOT) {
        // Let the browser's default clear this box; onChange handles state.
        return;
      }
      if (index > 0) {
        event.preventDefault();
        const next = digits.slice();
        next[index - 1] = EMPTY_SLOT;
        commit(next);
        inputRefs.current[index - 1]?.focus();
      }
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < LENGTH - 1) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(index: number, event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
    if (pasted.length === 0) return;
    event.preventDefault();
    const next = digits.slice();
    for (let i = 0; i < pasted.length && index + i < LENGTH; i++) {
      next[index + i] = pasted[i];
    }
    commit(next);
    const lastFilled = Math.min(index + pasted.length, LENGTH) - 1;
    inputRefs.current[Math.min(lastFilled + 1, LENGTH - 1)]?.focus();
  }

  return (
    <div className="flex gap-2 sm:gap-2.5" role="group" aria-label={label}>
      {digits.map((digit, index) => {
        const isFilled = digit !== EMPTY_SLOT;
        const errorStyle = hasError ? { borderColor: "#E4A6A3", backgroundColor: "#FDF2F2" } : undefined;
        const filledStyle =
          !hasError && isFilled ? { borderColor: "var(--auth-border)", backgroundColor: "var(--auth-tint-3)" } : undefined;

        return (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            pattern="[0-9]*"
            maxLength={LENGTH}
            aria-label={`Digit ${index + 1} of ${LENGTH}`}
            value={isFilled ? digit : ""}
            disabled={disabled}
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            className={
              "font-heading-auth aspect-square min-w-0 flex-1 rounded-xl border-2 border-[var(--auth-border)] bg-[var(--auth-card-bg)] text-center text-[22px] font-semibold outline-none transition-colors focus-visible:ring-4 disabled:opacity-60" +
              (hasError
                ? " text-[#8C1F17] focus-visible:ring-[#E4A6A3]/30"
                : " text-[var(--auth-text-primary)] focus-visible:border-[var(--auth-accent)] focus-visible:ring-[var(--auth-accent)]/20")
            }
            style={errorStyle ?? filledStyle}
          />
        );
      })}
    </div>
  );
}
