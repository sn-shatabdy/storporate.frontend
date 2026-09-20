import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import type {
  ExplorationDetail,
  ExplorationMessage,
} from "@/lib/api/growth";

import { ConversationColumn } from "./advisor-conversation";

/**
 * QuestionsBlock reset test — Phase 5 / Step 3 of STOR-40.
 *
 * Contract: when a NEW advisor message (different id, same text length)
 * arrives, the previously typed answers AND selected chips MUST be
 * cleared (the `key={messageId}` on QuestionsBlock forces a remount and
 * re-initializes the drafts state).
 *
 * This test mounts the ConversationColumn twice with a different last
 * advisor message each time. The questions text length is identical
 * between the two fixtures so the test would have failed under the
 * OLD `${paragraphs.length}-${content.length}` reset key, since both
 * pieces of that key are unchanged. The `messageId`-based key is the
 * one that triggers the remount.
 */

function makeDetail(
  overrides: Partial<ExplorationDetail> = {},
): ExplorationDetail {
  return {
    id: "expl-1",
    title: "Test",
    status: "Idle",
    lastError: null,
    createdAt: "2026-09-19T15:00:00Z",
    updatedAt: "2026-09-19T15:00:00Z",
    messages: [],
    latestSummary: null,
    ...overrides,
  };
}

function advisorMessage(
  id: string,
  content: string,
  questions: ExplorationMessage["questions"] = null,
): ExplorationMessage {
  return {
    id,
    role: "Advisor",
    content,
    questions,
    createdAt: "2026-09-19T15:00:00Z",
  };
}

describe("ConversationColumn — QuestionsBlock reset on new advisor message", () => {
  it("renders fresh empty drafts when the last advisor message id changes (same text length as the previous one)", () => {
    // Both messages have a 30-char content string so the old reset key
    // (`${paragraphs.length}-${content.length}`) is identical. Only the
    // `messageId`-based key differs.
    const firstMessage = advisorMessage("m1", "A".repeat(30), [
      { prompt: "Q?", options: ["A", "B"] },
    ]);
    const secondMessage = advisorMessage("m2", "B".repeat(30), [
      { prompt: "Q?", options: ["A", "B"] },
    ]);

    // First mount: student types an answer and picks a chip.
    const firstDetail = makeDetail({ messages: [firstMessage] });
    const { unmount } = render(
      <ConversationColumn
        detail={firstDetail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={firstMessage.questions ?? []}
        onSubmitMessage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "A" }));
    const inputsBefore = screen.getAllByPlaceholderText(
      "Or write your own answer",
    );
    fireEvent.change(inputsBefore[0], {
      target: { value: "typed answer for m1" },
    });

    expect(screen.getByRole("button", { name: "A" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(inputsBefore[0]).toHaveValue("typed answer for m1");

    unmount();

    // Second mount: same questions prompt + same options, but a
    // DIFFERENT message id (and same content length). The drafts must
    // be empty (chip un-pressed, input empty).
    const secondDetail = makeDetail({ messages: [secondMessage] });
    render(
      <ConversationColumn
        detail={secondDetail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={secondMessage.questions ?? []}
        onSubmitMessage={vi.fn()}
      />,
    );

    const chip = screen.getByRole("button", { name: "A" });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    const input = screen.getByPlaceholderText("Or write your own answer");
    expect(input).toHaveValue("");
  });
});
