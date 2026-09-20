"use client";

import { useCallback, useState } from "react";
import {
  Check,
  Send,
  Sparkles,
} from "lucide-react";

import { ApiError } from "@/lib/api/errors";
import type {
  ExplorationDetail,
  ExplorationMessage,
  ExplorationQuestion,
} from "@/lib/api/growth";
import {
  parseStudentMessage,
  splitParagraphs,
} from "@/lib/growth/parse-message";

import { FailedAlert } from "@/components/advisor/failed-alert";

/**
 * STOR-40 Phase 5 — the conversation column extracted out of
 * `advisor-detail.tsx`. Renders the message thread (advisor / student
 * bubbles, with the active advisor questions inside the LAST advisor
 * message's column), the typing/working/failed tail, and the reply
 * form (either the answers form while questions are pending or the
 * free-text composer otherwise).
 */

interface OnSubmitArgs {
  content?: string;
  answers: Array<{ question: string; answer: string }>;
}

export interface ConversationColumnProps {
  detail: ExplorationDetail;
  isWorking: boolean;
  isFailed: boolean;
  onRetry: () => void;
  pendingQuestions: ExplorationQuestion[];
  onSubmitMessage: (args: OnSubmitArgs) => Promise<void> | void;
}

export function ConversationColumn({
  detail,
  isWorking,
  isFailed,
  onRetry,
  pendingQuestions,
  onSubmitMessage,
}: ConversationColumnProps) {
  // The conversation card stays in the DOM at all times; only the
  // reply-form slot switches between the answers form (while the last
  // Advisor message has unanswered questions) and the free-text
  // composer. The parent already computed `pendingQuestions` from the
  // last Advisor message and only passes non-empty arrays.
  const hasActiveQuestions = pendingQuestions.length > 0;
  const activeAdvisorMessageId =
    hasActiveQuestions ? detail.messages[detail.messages.length - 1]?.id ?? null : null;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border bg-card"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="flex flex-col gap-5 p-4 lg:p-6">
        {detail.messages.length === 0 && isWorking && (
          <AdvisorWorkingPlaceholder />
        )}
        {detail.messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isLastAdvisor={message.id === activeAdvisorMessageId}
            activeQuestions={message.id === activeAdvisorMessageId ? pendingQuestions : []}
            onSubmitAnswers={onSubmitMessage}
          />
        ))}
        {isWorking && detail.messages.length > 0 && <WorkingDots />}
        {isFailed && <FailedAlert onRetry={onRetry} />}
      </div>

      {!hasActiveQuestions && (
        <Composer isWorking={isWorking} onSubmit={onSubmitMessage} />
      )}
    </div>
  );
}

// --------------------------------------------------------------------
// Message bubble (advisor or student)
// --------------------------------------------------------------------

interface MessageBubbleProps {
  message: ExplorationMessage;
  isLastAdvisor: boolean;
  activeQuestions: ExplorationQuestion[];
  onSubmitAnswers: (args: OnSubmitArgs) => Promise<void> | void;
}

function MessageBubble({
  message,
  isLastAdvisor,
  activeQuestions,
  onSubmitAnswers,
}: MessageBubbleProps) {
  if (message.role === "Student") {
    return <StudentBubble content={message.content} />;
  }
  return (
    <AdvisorBubble
      messageId={message.id}
      content={message.content}
      questions={isLastAdvisor ? activeQuestions : []}
      onSubmitAnswers={onSubmitAnswers}
    />
  );
}

function StudentBubble({ content }: { content: string }) {
  const { body, pairs } = parseStudentMessage(content);
  const bodyParagraphs = splitParagraphs(body);

  return (
    <div className="flex justify-end">
      <div
        className="max-w-[78%] rounded-[14px] px-3.5 py-3"
        style={{ background: "#e8eef2" }}
      >
        {bodyParagraphs.map((para, i) => (
          <p
            key={i}
            className="text-sm leading-[1.6] text-foreground whitespace-pre-line"
            style={i === 0 ? undefined : { marginTop: 10 }}
          >
            {para}
          </p>
        ))}
        {pairs.length > 0 && (
          <PairsContainer body={body} pairs={pairs} />
        )}
      </div>
    </div>
  );
}

function PairsContainer({
  body,
  pairs,
}: {
  body: string;
  pairs: Array<{ question: string; answer: string }>;
}) {
  // Per design: the top border + margin only appear when the body is
  // non-empty. Pairs-only renders with no top border and no top margin
  // (the reference HTML shows a stray top border there; we ignore it).
  const hasBody = body.length > 0;
  return (
    <div
      className={
        hasBody
          ? "mt-2.5 flex flex-col gap-2.5 border-t pt-2.5"
          : "flex flex-col gap-2.5"
      }
      style={hasBody ? { borderColor: "rgba(52,90,115,0.2)" } : undefined}
    >
      {pairs.map((pair, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{pair.question}</span>
          <span className="text-sm font-semibold text-foreground">
            {pair.answer}
          </span>
        </div>
      ))}
    </div>
  );
}

function AdvisorBubble({
  messageId,
  content,
  questions,
  onSubmitAnswers,
}: {
  messageId: string;
  content: string;
  questions: ExplorationQuestion[];
  onSubmitAnswers: (args: OnSubmitArgs) => Promise<void> | void;
}) {
  const paragraphs = splitParagraphs(content);
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex size-[30px] shrink-0 items-center justify-center rounded-full"
        style={{ background: "#e7f0ed", color: "#4d7ea0" }}
      >
        <Sparkles className="size-4" strokeWidth={1.9} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <span className="text-xs font-semibold text-muted-foreground">
          Advisor
        </span>
        {paragraphs.map((para, i) => (
          <p
            key={i}
            className="text-sm leading-[1.6] text-foreground whitespace-pre-line"
            style={i === 0 ? undefined : { marginTop: 0 }}
          >
            {para}
          </p>
        ))}
        {questions.length > 0 && (
          <QuestionsBlock
            key={messageId}
            questions={questions}
            onSubmitAnswers={onSubmitAnswers}
          />
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Questions block (lives INSIDE the active advisor message)
// --------------------------------------------------------------------

interface QuestionsBlockProps {
  questions: ExplorationQuestion[];
  onSubmitAnswers: (args: OnSubmitArgs) => Promise<void> | void;
}

interface QuestionDraft {
  selected: string | null;
  typed: string;
}

function QuestionsBlock({
  questions,
  onSubmitAnswers,
}: QuestionsBlockProps) {
  const [drafts, setDrafts] = useState<QuestionDraft[]>(() =>
    questions.map(() => ({ selected: null, typed: "" })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const toggleChip = useCallback((qIndex: number, option: string) => {
    setDrafts((prev) => {
      const next = prev.slice();
      const current = next[qIndex] ?? { selected: null, typed: "" };
      next[qIndex] = {
        selected: current.selected === option ? null : option,
        typed: current.typed,
      };
      return next;
    });
  }, []);

  const setTyped = useCallback((qIndex: number, text: string) => {
    setDrafts((prev) => {
      const next = prev.slice();
      const current = next[qIndex] ?? { selected: null, typed: "" };
      next[qIndex] = { selected: current.selected, typed: text };
      return next;
    });
  }, []);

  const answers = drafts.map((d, i) => {
    const typed = d.typed.trim();
    return {
      question: questions[i]?.prompt ?? "",
      answer: typed.length > 0 ? typed : d.selected ?? "",
    };
  });
  const answeredCount = answers.filter((a) => a.answer.length > 0).length;

  async function handleSubmit() {
    if (submitting || answeredCount === 0) return;
    const submitted = answers.filter((a) => a.answer.length > 0);
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmitAnswers({ answers: submitted });
      // Clear drafts so a fresh question can come in.
      setDrafts(questions.map(() => ({ selected: null, typed: "" })));
    } catch (error) {
      setSubmitError(messageForError(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="questions-block">
      {questions.map((q, i) => (
        <QuestionCard
          key={i}
          index={i + 1}
          prompt={q.prompt}
          options={q.options}
          selected={drafts[i]?.selected ?? null}
          typed={drafts[i]?.typed ?? ""}
          disabled={submitting}
          onChipClick={(option) => toggleChip(i, option)}
          onTypedChange={(text) => setTyped(i, text)}
        />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          You can answer some or all.
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || answeredCount === 0}
          className="inline-flex h-9 w-full items-center justify-center rounded-[10px] px-3.5 text-sm font-semibold gap-2 sm:w-auto disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "#4d7ea0", color: "#ffffff", border: "1px solid #4d7ea0" }}
        >
          <Send className="size-4" />
          Send answers
        </button>
      </div>
      {submitError && (
        <p role="alert" className="text-[13px]" style={{ color: "#b3261e" }}>
          {submitError}
        </p>
      )}
    </div>
  );
}

interface QuestionCardProps {
  index: number;
  prompt: string;
  options: string[];
  selected: string | null;
  typed: string;
  disabled: boolean;
  onChipClick: (option: string) => void;
  onTypedChange: (text: string) => void;
}

function QuestionCard({
  index,
  prompt,
  options,
  selected,
  typed,
  disabled,
  onChipClick,
  onTypedChange,
}: QuestionCardProps) {
  return (
    <div
      className="flex flex-col gap-2.5 rounded-[14px] border p-4"
      style={{ background: "#fbf8ec", borderColor: "#e7dfc0" }}
    >
      <div className="flex items-baseline gap-2.5">
        <span className="font-heading text-[13px] font-semibold text-muted-foreground">
          {index}
        </span>
        <span className="text-sm font-semibold leading-normal text-foreground">
          {prompt}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChipClick(option)}
              className={
                isSelected
                  ? "inline-flex items-center gap-1.5 rounded-full border px-3 py-[7px] text-[13px] font-semibold transition-colors"
                  : "inline-flex items-center rounded-full border bg-white px-3 py-[7px] text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
              }
              style={
                isSelected
                  ? {
                      background: "#e7f0ed",
                      borderColor: "#4d7ea0",
                      color: "#345a73",
                    }
                  : { borderColor: "#e7dfc0" }
              }
            >
              {isSelected && <Check className="size-[13px]" strokeWidth={2.4} />}
              {option}
            </button>
          );
        })}
      </div>
      <label className="block">
        <span className="sr-only">Your own answer to: {prompt}</span>
        <input
          type="text"
          value={typed}
          onChange={(e) => onTypedChange(e.target.value)}
          placeholder="Or write your own answer"
          maxLength={1000}
          disabled={disabled}
          className="block h-[38px] w-full rounded-[10px] border bg-white px-3 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60"
          style={{ borderColor: "#e7dfc0" }}
        />
      </label>
    </div>
  );
}

// --------------------------------------------------------------------
// Composer (free-text reply when there are no active questions)
// --------------------------------------------------------------------

function Composer({
  isWorking,
  onSubmit,
}: {
  isWorking: boolean;
  onSubmit: (args: OnSubmitArgs) => Promise<void> | void;
}) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const disabled = isWorking || submitting;

  async function handleSend() {
    const trimmed = content.trim();
    if (trimmed.length === 0 || disabled) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({ content: trimmed, answers: [] });
      setContent("");
    } catch (error) {
      setSubmitError(messageForError(error));
    } finally {
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div
      className="flex flex-col gap-2.5 border-t px-5 pb-5 pt-4"
      style={{ borderColor: "#e7dfc0" }}
    >
      <label className="block">
        <span className="sr-only">Message to the advisor</span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isWorking
              ? "The advisor is working on your last message"
              : "Write a message"
          }
          disabled={disabled}
          maxLength={4000}
          className="block min-h-[72px] w-full resize-none rounded-xl border bg-white px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-[0.55]"
          style={{ borderColor: "#e7dfc0" }}
        />
      </label>
      {submitError && (
        <p role="alert" className="text-[13px]" style={{ color: "#b3261e" }}>
          {submitError}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {disabled ? "This takes about a minute." : ""}
        </span>
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={disabled || content.trim().length === 0}
          className="inline-flex h-9 items-center justify-center rounded-[10px] px-3.5 text-sm font-semibold gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ background: "#4d7ea0", color: "#ffffff", border: "1px solid #4d7ea0" }}
        >
          <Send className="size-4" />
          Send
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Typing / working / failed tails
// --------------------------------------------------------------------

function WorkingDots() {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex size-[30px] shrink-0 items-center justify-center rounded-full"
        style={{ background: "#e7f0ed", color: "#4d7ea0" }}
      >
        <Sparkles className="size-4" strokeWidth={1.9} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <span className="text-xs font-semibold text-muted-foreground">
          Advisor
        </span>
        <span
          role="status"
          aria-label="The advisor is writing"
          className="inline-flex w-fit items-center gap-1.5 rounded-[14px] px-3.5 py-3"
          style={{ background: "#f3efdd" }}
        >
          <span
            className="size-2 rounded-full"
            style={{ background: "#4d7ea0", opacity: 0.9 }}
          />
          <span
            className="size-2 rounded-full"
            style={{ background: "#4d7ea0", opacity: 0.55 }}
          />
          <span
            className="size-2 rounded-full"
            style={{ background: "#4d7ea0", opacity: 0.3 }}
          />
        </span>
      </div>
    </div>
  );
}

function AdvisorWorkingPlaceholder() {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex size-[30px] shrink-0 items-center justify-center rounded-full"
        style={{ background: "#e7f0ed", color: "#4d7ea0" }}
      >
        <Sparkles className="size-4" strokeWidth={1.9} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <span className="text-xs font-semibold text-muted-foreground">
          Advisor
        </span>
        <p className="text-sm leading-[1.6] text-foreground whitespace-pre-line">
          Reading your portfolio.
        </p>
        <div className="flex flex-col gap-2.5">
          <div
            className="h-3 w-full rounded-md animate-pulse motion-reduce:animate-none"
            style={{ background: "#f3efdd" }}
          />
          <div
            className="h-3 w-[92%] rounded-md animate-pulse motion-reduce:animate-none"
            style={{ background: "#f3efdd" }}
          />
          <div
            className="h-3 w-[64%] rounded-md animate-pulse motion-reduce:animate-none"
            style={{ background: "#f3efdd" }}
          />
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------

function messageForError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Try again.";
}
