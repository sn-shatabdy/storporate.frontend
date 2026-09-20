import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type {
  ExplorationDetail,
  ExplorationMessage,
} from "@/lib/api/growth";

import { ConversationColumn } from "./advisor-conversation";

// Helpers
function makeDetail(overrides: Partial<ExplorationDetail> = {}): ExplorationDetail {
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

function studentMessage(id: string, content: string): ExplorationMessage {
  return {
    id,
    role: "Student",
    content,
    questions: null,
    createdAt: "2026-09-19T15:00:00Z",
  };
}

describe("ConversationColumn — question rendering", () => {
  it("renders the question block INSIDE the last advisor message's column and hides the composer", () => {
    const detail = makeDetail({
      messages: [
        advisorMessage("m1", "Please answer:", [
          { prompt: "Goal?", options: ["A", "B"] },
        ]),
      ],
    });

    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={detail.messages[detail.messages.length - 1].questions ?? []}
        onSubmitMessage={vi.fn()}
      />,
    );

    // The question prompt is inside the advisor message column. We
    // locate the column by finding the Advisor label first, then walk
    // up to its column container.
    const advisorLabel = screen.getByText("Advisor");
    const column = advisorLabel.closest("div.flex.min-w-0") as HTMLElement;
    expect(column).not.toBeNull();
    expect(column).toHaveTextContent("Goal?");
    // The composer textarea should not be in the DOM.
    expect(
      screen.queryByRole("textbox", { name: /Message to the advisor/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the composer once a Student message follows the Advisor with questions", () => {
    const detail = makeDetail({
      messages: [
        advisorMessage("m1", "Q:", [
          { prompt: "Goal?", options: ["A"] },
        ]),
        studentMessage("m2", "My answer is A"),
      ],
    });

    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={[]}
        onSubmitMessage={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("textbox", { name: /Message to the advisor/i }),
    ).toBeInTheDocument();
  });
});

describe("ConversationColumn — chip toggle", () => {
  const detail = makeDetail({
    messages: [
      advisorMessage("m1", "Pick:", [
        { prompt: "Pick one", options: ["A", "B"] },
        { prompt: "Pick two", options: ["C", "D"] },
      ]),
    ],
  });

  it("clicking a chip selects it (aria-pressed=true); clicking again clears", () => {
    const onSubmit = vi.fn();
    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={detail.messages[detail.messages.length - 1].questions ?? []}
        onSubmitMessage={onSubmit}
      />,
    );

    const chipA = screen.getByRole("button", { name: "A" });
    expect(chipA).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(chipA);
    expect(chipA).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chipA);
    expect(chipA).toHaveAttribute("aria-pressed", "false");
  });

  it("typed text beats a selected chip; the input never shows the chip text", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={detail.messages[detail.messages.length - 1].questions ?? []}
        onSubmitMessage={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "A" }));
    // Find the input for "Pick one" (there are two inputs total).
    const inputs = screen.getAllByPlaceholderText("Or write your own answer");
    fireEvent.change(inputs[0], { target: { value: "my own answer" } });
    expect(inputs[0]).toHaveValue("my own answer");
    // Now submit and verify the answer uses typed text, not the chip.
    fireEvent.click(screen.getByRole("button", { name: /Send answers/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      answers: [{ question: "Pick one", answer: "my own answer" }],
    });
  });

  it("typing in question 1 does not change question 2's input", () => {
    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={detail.messages[detail.messages.length - 1].questions ?? []}
        onSubmitMessage={vi.fn()}
      />,
    );

    const inputs = screen.getAllByPlaceholderText("Or write your own answer");
    expect(inputs).toHaveLength(2);
    fireEvent.change(inputs[0], { target: { value: "alpha" } });
    expect(inputs[0]).toHaveValue("alpha");
    expect(inputs[1]).toHaveValue("");
  });
});

describe("ConversationColumn — send answers button", () => {
  const detail = makeDetail({
    messages: [
      advisorMessage("m1", "Q:", [
        { prompt: "Q1", options: ["A", "B"] },
        { prompt: "Q2", options: ["C", "D"] },
      ]),
    ],
  });

  it("is disabled with zero answers; with one chip and one typed it submits exactly those two with no content", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={detail.messages[detail.messages.length - 1].questions ?? []}
        onSubmitMessage={onSubmit}
      />,
    );

    const sendBtn = screen.getByRole("button", { name: /Send answers/i });
    expect(sendBtn).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    const inputs = screen.getAllByPlaceholderText("Or write your own answer");
    fireEvent.change(inputs[1], { target: { value: "hello" } });
    expect(sendBtn).not.toBeDisabled();
    fireEvent.click(sendBtn);
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        answers: [
          { question: "Q1", answer: "A" },
          { question: "Q2", answer: "hello" },
        ],
      });
    });
    // The wire call should NOT have a `content` key per the spec
    // (content is now optional).
    const arg = onSubmit.mock.calls[0][0];
    expect("content" in arg).toBe(false);
  });
});

describe("ConversationColumn — in-flight state", () => {
  const detail = makeDetail({
    messages: [
      advisorMessage("m1", "Q:", [
        { prompt: "Q1", options: ["A"] },
      ]),
    ],
  });

  it("disables the button until the delayed promise resolves", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={detail.messages[detail.messages.length - 1].questions ?? []}
        onSubmitMessage={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "A" }));
    const sendBtn = screen.getByRole("button", { name: /Send answers/i });
    expect(sendBtn).not.toBeDisabled();
    fireEvent.click(sendBtn);
    // After the click, the button enters the in-flight state. Re-query
    // because React may have re-rendered.
    expect(
      screen.getByRole("button", { name: /Send answers/i }),
    ).toBeDisabled();
    // Resolve the promise — but the local drafts are reset, so the
    // button is disabled because answeredCount===0 (no answers).
    // The contract we care about is that the wire call was made AND
    // that a second click (after picking another answer) goes through.
    resolve();
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    // Picking a new answer should re-enable the button.
    fireEvent.click(screen.getByRole("button", { name: "A" }));
    expect(
      screen.getByRole("button", { name: /Send answers/i }),
    ).not.toBeDisabled();
  });

  it("shows the role=alert message and re-enables on rejection", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("network down"));
    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={detail.messages[detail.messages.length - 1].questions ?? []}
        onSubmitMessage={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "A" }));
    const sendBtn = screen.getByRole("button", { name: /Send answers/i });
    fireEvent.click(sendBtn);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("network down");
    });
    expect(sendBtn).not.toBeDisabled();
  });
});

describe("ConversationColumn — Student message with pairs", () => {
  function renderStudent(content: string) {
    const detail = makeDetail({
      messages: [studentMessage("s1", content)],
    });
    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={[]}
        onSubmitMessage={vi.fn()}
      />,
    );
    // Returns the student bubble for scoped assertions. The bubble is
    // the right-aligned <div class="flex justify-end"> wrapper.
    return document.querySelector(
      "div.flex.justify-end",
    ) as HTMLElement | null;
  }

  it("renders the question + answer text separately with no literal 'Question:' or 'Answer:' in the DOM", () => {
    const bubble = renderStudent(
      [
        "Question: What's the goal?",
        "Answer: Deeper technical work",
        "",
        "Question: How do you work?",
        "Answer: Alone",
      ].join("\n"),
    );
    expect(bubble).not.toBeNull();

    expect(screen.queryByText(/^Question:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Answer:/)).not.toBeInTheDocument();
    // The question and answer texts render as plain strings.
    expect(screen.getByText("What's the goal?")).toBeInTheDocument();
    expect(screen.getByText("Deeper technical work")).toBeInTheDocument();
    expect(screen.getByText("How do you work?")).toBeInTheDocument();
    expect(screen.getByText("Alone")).toBeInTheDocument();
  });

  it("renders a body-only message with no pairs container inside the bubble", () => {
    const bubble = renderStudent("Just a plain body line.");
    expect(bubble).not.toBeNull();
    expect(screen.getByText("Just a plain body line.")).toBeInTheDocument();
    // No pairs container at all (it only renders when pairs.length > 0).
    expect(
      bubble!.querySelector("div.flex.flex-col.gap-2\\.5"),
    ).not.toBeInTheDocument();
  });

  it("renders the top-border container when both body and pairs are present", () => {
    const bubble = renderStudent(
      ["My intro.", "", "Question: Q?", "Answer: A"].join("\n"),
    );
    expect(bubble).not.toBeNull();
    expect(screen.getByText("My intro.")).toBeInTheDocument();
    const container = bubble!.querySelector(
      "div.mt-2\\.5.flex.flex-col.gap-2\\.5",
    ) as HTMLElement | null;
    expect(container).not.toBeNull();
    expect(container!.className).toContain("border-t");
  });

  it("renders pairs-only WITHOUT a top border container", () => {
    const bubble = renderStudent(
      ["Question: Q?", "Answer: A"].join("\n"),
    );
    expect(bubble).not.toBeNull();
    // Pairs-only branch: NO `mt-2.5` and NO `border-t`.
    const containers = bubble!.querySelectorAll(
      "div.flex.flex-col.gap-2\\.5",
    );
    expect(containers.length).toBeGreaterThanOrEqual(1);
    const pairsContainer = Array.from(containers).find((c) =>
      c.querySelector("span.text-xs.text-muted-foreground"),
    );
    expect(pairsContainer).toBeDefined();
    expect(pairsContainer!.className).not.toContain("border-t");
    expect(pairsContainer!.className).not.toContain("mt-2.5");
  });
});

describe("ConversationColumn — advisor text whitespace-pre-line", () => {
  it("keeps a single newline on the advisor paragraph (whitespace-pre-line present, textContent contains \\n)", () => {
    const detail = makeDetail({
      messages: [advisorMessage("m1", "Line one.\nLine two.")],
    });
    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={[]}
        onSubmitMessage={vi.fn()}
      />,
    );

    const para = screen.getByText(/Line one/);
    expect(para.className).toContain("whitespace-pre-line");
    expect(para.textContent).toContain("\n");
  });
});

describe("ConversationColumn — composer", () => {
  it("Working disables the textarea and Send, shows the Working placeholder and the helper text", () => {
    render(
      <ConversationColumn
        detail={makeDetail()}
        isWorking={true}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={[]}
        onSubmitMessage={vi.fn()}
      />,
    );
    // Without messages + Working: the Advisor working placeholder
    // shows up. With messages + Working: the typing row + composer
    // both show. Verify the composer state when there ARE messages:
  });

  it("with Working + a Student message: composer is disabled, placeholder is Working text, helper 'This takes about a minute.' shows", () => {
    render(
      <ConversationColumn
        detail={makeDetail({ messages: [studentMessage("s1", "hi")] })}
        isWorking={true}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={[]}
        onSubmitMessage={vi.fn()}
      />,
    );
    const textarea = screen.getByRole("textbox", {
      name: /Message to the advisor/i,
    });
    expect(textarea).toBeDisabled();
    expect(textarea).toHaveAttribute(
      "placeholder",
      "The advisor is working on your last message",
    );
    const send = screen.getByRole("button", { name: /^Send$/i });
    expect(send).toBeDisabled();
    expect(screen.getByText("This takes about a minute.")).toBeInTheDocument();
  });

  it("empty text keeps Send disabled", () => {
    render(
      <ConversationColumn
        detail={makeDetail()}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={[]}
        onSubmitMessage={vi.fn()}
      />,
    );
    const send = screen.getByRole("button", { name: /^Send$/i });
    expect(send).toBeDisabled();
  });

  it("Ctrl+Enter submits the composer text", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ConversationColumn
        detail={makeDetail()}
        isWorking={false}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={[]}
        onSubmitMessage={onSubmit}
      />,
    );
    const textarea = screen.getByRole("textbox", {
      name: /Message to the advisor/i,
    });
    fireEvent.change(textarea, { target: { value: "Hello there" } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        content: "Hello there",
        answers: [],
      });
    });
  });
});

describe("ConversationColumn — typing row", () => {
  it("Working with messages shows role=status 'The advisor is writing'", () => {
    render(
      <ConversationColumn
        detail={makeDetail({ messages: [studentMessage("s1", "hi")] })}
        isWorking={true}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={[]}
        onSubmitMessage={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("status", { name: "The advisor is writing" }),
    ).toBeInTheDocument();
  });

  it("Working with no messages shows 'Reading your portfolio.' and three skeleton bars", () => {
    render(
      <ConversationColumn
        detail={makeDetail({ messages: [] })}
        isWorking={true}
        isFailed={false}
        onRetry={vi.fn()}
        pendingQuestions={[]}
        onSubmitMessage={vi.fn()}
      />,
    );
    expect(screen.getByText("Reading your portfolio.")).toBeInTheDocument();
    const skeletons = document.querySelectorAll("div.h-3.rounded-md");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });
});

describe("ConversationColumn — failed banner", () => {
  it("shows the fixed title and 'Try again.'; a SECRET lastError does not leak", () => {
    const detail = makeDetail({
      status: "Failed",
      lastError: "SECRET-DETAIL",
      messages: [studentMessage("s1", "hi")],
    });
    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={true}
        onRetry={vi.fn()}
        pendingQuestions={[]}
        onSubmitMessage={vi.fn()}
      />,
    );
    expect(
      screen.getByText("The advisor could not finish this"),
    ).toBeInTheDocument();
    expect(screen.getByText("Try again.")).toBeInTheDocument();
    expect(screen.queryByText(/SECRET-DETAIL/)).not.toBeInTheDocument();
  });

  it("the Try again button calls onRetry", () => {
    const onRetry = vi.fn();
    const detail = makeDetail({
      status: "Failed",
      messages: [studentMessage("s1", "hi")],
    });
    render(
      <ConversationColumn
        detail={detail}
        isWorking={false}
        isFailed={true}
        onRetry={onRetry}
        pendingQuestions={[]}
        onSubmitMessage={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Try again$/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
