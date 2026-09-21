"use client";

import { forwardRef, useId, useState } from "react";
import { X } from "lucide-react";

import { cn } from "cn";

import { addSkills, LIMITS } from "./posting-helpers";

/**
 * Skill tag input. Enter or comma adds the typed skill, Backspace on an empty
 * box removes the last one, and every skill is a removable pill. The draft
 * text lives in the parent so a submit can include a half typed skill.
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
  }
>(function TagInput(
  { id, skills, onSkillsChange, draft, onDraftChange, error, disabled, describedBy },
  ref,
) {
  const noticeId = useId();
  const [notice, setNotice] = useState<string | null>(null);
  const atMax = skills.length >= LIMITS.skillsMax;
  const message = notice ?? error ?? null;

  function commit(raw: string) {
    if (!raw.trim()) {
      setNotice(null);
      return;
    }
    const result = addSkills(skills, raw);
    onSkillsChange(result.skills);
    setNotice(result.error);
    // Keep the text (without commas) so the person can fix it.
    onDraftChange(result.error ? raw.replace(/,/g, "") : "");
  }

  return (
    <div className="flex flex-col">
    <div
      className={cn(
        "flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border bg-background px-2.5 py-2 focus-within:ring-2 focus-within:ring-ring/40",
        error ? "border-[#b3261e]" : "border-input",
        disabled && "opacity-60",
      )}
    >
      {skills.map((skill) => (
        <span
          key={skill}
          className="inline-flex items-center gap-1 rounded-full bg-accent py-[3px] pl-2.5 pr-1 text-[12px] font-medium text-[#345a73]"
        >
          {skill}
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${skill}`}
            onClick={() => onSkillsChange(skills.filter((s) => s !== skill))}
            className="inline-flex size-5 items-center justify-center rounded-full text-[#345a73] hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <X className="size-3" aria-hidden />
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
        placeholder={skills.length === 0 ? "Type a skill and press Enter" : atMax ? "" : "Add another"}
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
        className="min-w-[10rem] flex-1 bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
      {message ? (
        <p id={noticeId} className="mt-1.5 text-xs font-medium text-[#B3261E]">
          {message}
        </p>
      ) : null}
    </div>
  );
});
