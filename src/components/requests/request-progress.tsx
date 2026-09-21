import { Check, X } from "lucide-react";

import type { RequestStatus } from "@/lib/api/sponsorshipRequests";

import { formatDay, statusLabel } from "./request-helpers";

const MAIN_STEPS: RequestStatus[] = ["Sent", "Viewed", "InDiscussion", "Agreed", "Completed"];
const DECLINED_STEPS: RequestStatus[] = ["Sent", "Viewed", "Declined"];

export type ProgressDates = Partial<Record<RequestStatus, string | null | undefined>>;

/**
 * Compact progress track for one request. It is an ordered list and the
 * current step carries `aria-current="step"`. A declined request ends the
 * track at Declined instead of continuing to Agreed and Completed.
 */
export function RequestProgress({
  status,
  dates = {},
}: {
  status: RequestStatus;
  /** Optional timestamp shown under a step that has happened. */
  dates?: ProgressDates;
}) {
  const steps = status === "Declined" ? DECLINED_STEPS : MAIN_STEPS;
  const current = Math.max(steps.indexOf(status), 0);

  return (
    <ol aria-label="Request progress" className="flex w-full items-start">
      {steps.map((step, index) => {
        const state = index < current ? "done" : index === current ? "current" : "upcoming";
        const reached = index <= current;
        const isDeclined = step === "Declined";
        const date = state === "upcoming" ? "" : formatDay(dates[step]);
        const lineColor = reached
          ? isDeclined
            ? "before:bg-[#a4460f]"
            : "before:bg-primary"
          : "before:bg-border";
        return (
          <li
            key={step}
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
            className={`relative flex min-w-0 flex-1 flex-col items-center gap-1.5 px-0.5 text-center ${
              index > 0
                ? `before:absolute before:right-1/2 before:top-[11px] before:h-0.5 before:w-full ${lineColor}`
                : ""
            }`}
          >
            <span
              aria-hidden
              className={`relative z-10 flex size-6 items-center justify-center rounded-full border-2 ${dotClasses(state, isDeclined, step)}`}
            >
              {state === "done" || (state === "current" && step === "Completed") ? (
                <Check className="size-3.5" strokeWidth={3} />
              ) : isDeclined ? (
                <X className="size-3.5" strokeWidth={3} />
              ) : state === "current" ? (
                <span className="size-2 rounded-full bg-primary" />
              ) : null}
            </span>
            <span
              className={`break-words text-[11px] leading-tight sm:text-xs ${
                state === "current"
                  ? "font-semibold text-foreground"
                  : state === "done"
                    ? "font-medium text-foreground"
                    : "font-medium text-muted-foreground"
              }`}
            >
              <span className="sr-only">
                {state === "done" ? "Done: " : state === "current" ? "Current step: " : "Upcoming: "}
              </span>
              {statusLabel(step)}
            </span>
            {date ? (
              <span className="text-[10.5px] leading-tight text-muted-foreground">{date}</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function dotClasses(state: string, isDeclined: boolean, step: RequestStatus): string {
  if (isDeclined) return "border-[#a4460f] bg-[#fbeee7] text-[#a4460f]";
  if (state === "done") return "border-primary bg-primary text-primary-foreground";
  if (state === "current") {
    return step === "Completed"
      ? "border-[#2a1830] bg-[#2a1830] text-[#fbf8ec]"
      : "border-primary bg-white";
  }
  return "border-border bg-white";
}
