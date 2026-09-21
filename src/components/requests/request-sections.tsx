import type { ReactNode } from "react";
import { Building2, CalendarDays, GraduationCap, Wallet } from "lucide-react";

import type { RequestDetail } from "@/lib/api/sponsorshipRequests";

import { formatAmount, formatDay } from "./request-helpers";
import type { RequestSide } from "./request-thread";

const CARD = "flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm sm:p-6";
const SECTION_TITLE = "font-heading text-lg font-semibold text-foreground";
const SMALL_LABEL = "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={CARD} style={{ borderColor: "var(--border)" }}>
      <h2 id={id} className={SECTION_TITLE}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <p className="whitespace-pre-line break-words text-sm leading-6 text-foreground">{children}</p>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className={SMALL_LABEL}>{label}</p>
        <p className="break-words text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

/**
 * The read only body of a request: who it is between, the event, the ask and
 * the offer, plus the decision note and the outcome when they exist. Headings
 * speak to the viewer, so the same data reads right from either side.
 */
export function RequestSummarySections({
  request,
  side,
}: {
  request: RequestDetail;
  side: RequestSide;
}) {
  const club = side === "Club";
  const amount = formatAmount(request.amountRequested);
  const eventDate = formatDay(request.eventDate);
  const decided = formatDay(request.decidedAt);
  const completed = formatDay(request.completedAt);
  const outcomeAmount = formatAmount(request.outcome?.agreedAmount);

  return (
    <div className="flex flex-col gap-4">
      <Section id="request-parties" title={club ? "Sent to" : "Sent by"}>
        <div className="grid gap-4 sm:grid-cols-2">
          {club ? (
            <>
              <Fact icon={Building2} label="Company" value={request.company.name} />
              <Fact icon={Wallet} label="Goal set" value={request.company.goalName} />
            </>
          ) : (
            <>
              <Fact icon={Building2} label="Club" value={request.club.name} />
              <Fact icon={GraduationCap} label="University" value={request.club.university} />
            </>
          )}
          {eventDate ? <Fact icon={CalendarDays} label="Event date" value={eventDate} /> : null}
          {amount ? <Fact icon={Wallet} label="Amount asked" value={amount} /> : null}
        </div>
      </Section>

      <Section id="request-event" title="About the event">
        <Body>{request.eventDescription}</Body>
      </Section>

      <Section id="request-ask" title={club ? "What you are asking for" : "What the club asks for"}>
        <Body>{request.ask}</Body>
      </Section>

      <Section
        id="request-offer"
        title={club ? "What the company gets in return" : "What you get in return"}
      >
        <Body>{request.offer}</Body>
      </Section>

      {request.decisionNote ? (
        <Section
          id="request-decision"
          title={request.status === "Declined" ? "Reason for declining" : "Note on the decision"}
        >
          <Body>{request.decisionNote}</Body>
          {decided ? <p className="text-xs text-muted-foreground">Decided {decided}</p> : null}
        </Section>
      ) : null}

      {request.outcome ? (
        <Section id="request-outcome" title="Outcome">
          <Body>{request.outcome.note}</Body>
          {outcomeAmount ? (
            <p className="text-sm font-medium text-foreground">Final amount: {outcomeAmount}</p>
          ) : null}
          {completed ? <p className="text-xs text-muted-foreground">Completed {completed}</p> : null}
        </Section>
      ) : null}
    </div>
  );
}
