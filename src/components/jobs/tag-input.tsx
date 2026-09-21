"use client";

import { forwardRef, useId, useState } from "react";
import { X } from "lucide-react";

import { cn } from "cn";

import { addSkills, LIMITS } from "./posting-helpers";

/**
 * STOR-66 Phase 2 — skill tag input. Enter or comma adds the typed
 * skill, Backspace on an empty box removes the last one, and every skill
 * is a removable pill in the info-blue palette. The draft text lives in
 * the parent so a submit can include a half typed skill.
 */
export const TagInput = forwardRef<
  HTMLInputElement,
  {
    id: string;
    skills: string[];
    onSkillsChange: (next: string[]) => void;
    draft: string;
    onDraftChange: (next: string) => void;
    error?: string;
    disabled?: boolean;
    describedBy?: string;
    /** Defaults to the skill limit. */
    maxItems?: number;
    /** Defaults to `addSkills`. Lets other lists bring their own limits. */
    addItems?: (
      existing: string[],
      raw: string,
    ) => { skills: string[]; error: string | null };
    /** Shown while the list is empty. */
    placeholder?: string;
  }
>(function TagInput(
  {
    id,
    skills,
    onSkillsChange,
    draft,
    onDraftChange,
    error,
    disabled,
    describedBy,
    maxItems = LIMITS.skillsMax,
    addItems = addSkills,
    placeholder = "Add a skill",
  },
  ref,
) {
  const noticeId = useId();
  const [notice, setNotice] = useState<string | null>(null);
  const atMax = skills.length >= maxItems;
  const message = notice ?? error ?? null;

  function commit(raw: string) {
    if (!raw.trim()) {
      setNotice(null);
      return;
    }
    const result = addItems(skills, raw);
    onSkillsChange(result.skills);
    setNotice(result.error);
    // Keep the text (without commas) so the person can fix it.
    onDraftChange(result.error ? raw.replace(/,/g, "") : "");
  }

  return (
    <div className="flex flex-col gap-1.5">
    <div
      className={cn(
        "flex min-h-[52px] flex-wrap items-center gap-2 rounded-[10px] border bg-background px-2.5 py-2 focus-within:ring-2 focus-within:ring-ring/40",
        error ? "border-danger" : "border-border",
        disabled && "opacity-60",
      )}
    >
      {skills.map((skill) => (
        <span
          key={skill}
          className="inline-flex items-center gap-1.5 rounded-full bg-info-soft py-[3px] pl-3 pr-1 text-[13px] font-bold text-info"
        >
          {skill}
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${skill}`}
            onClick={() => onSkillsChange(skills.filter((s) => s !== skill))}
            className="inline-flex size-[22px] items-center justify-center rounded-full text-info hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <X className="size-3" strokeWidth={2.5} aria-hidden />
          </button>
        </span>
      ))}
      <input
        ref={ref}
        id={id}
        type="text"
        value={draft}
        disabled={disabled}
        maxLength={200}
        placeholder={skills.length === 0 ? placeholder : atMax ? "" : "Add another"}
        aria-invalid={error ? true : undefined}
        aria-describedby={[describedBy, message ? noticeId : null].filter(Boolean).join(" ") || undefined}
        onChange={(e) => {
          const value = e.target.value;
          setNotice(null);
          if (value.includes(",")) {
            commit(value);
          } else {
            onDraftChange(value);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            // Never submit the form from the tag box.
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && draft === "" && skills.length > 0) {
            onSkillsChange(skills.slice(0, -1));
          }
        }}
        onBlur={() => {
          commit(draft);
        }}
        className="min-w-[10rem] flex-1 bg-transparent py-1 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
      {message ? (
        <p id={noticeId} role="alert" className="text-xs font-medium text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
});
