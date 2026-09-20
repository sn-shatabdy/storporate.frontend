/**
 * One question/answer pair extracted from a Student message that was
 * sent in response to a question-bearing Advisor message.
 */
export interface StudentAnswerPair {
  question: string;
  answer: string;
}

/** Result of parsing a Student message. The wire shape stores a Student
 * message as optional free text (`body`) followed by zero or more answer
 * pairs, where each pair is encoded as a `Question: <q>\nAnswer: <a>`
 * block separated from neighbouring blocks by a blank line. */
export interface ParsedStudentMessage {
  body: string;
  pairs: StudentAnswerPair[];
}

/** Splits plain text into paragraphs on blank lines. Used to render
 * advisor message content (`text-sm leading-[1.6] whitespace-pre-line`)
 * and any free-text body on a student message. */
export function splitParagraphs(text: unknown): string[] {
  if (typeof text !== "string") return [];
  if (text.length === 0) return [];

  return text
    // Normalize Windows / Mac line endings to \n first.
    .replace(/\r\n?/g, "\n")
    // Split on a blank line (two or more newlines in a row).
    .split(/\n{2,}/)
    // Trim each paragraph; keep single newlines intact so the
    // `whitespace-pre-line` renderer preserves them.
    .map((paragraph) => paragraph.trim())
    // Drop empty paragraphs (e.g. trailing blank line).
    .filter((paragraph) => paragraph.length > 0);
}

/**
 * Parses a Student message payload into the optional free-text body and
 * zero or more `Question: … / Answer: …` answer pairs.
 *
 * Wire contract: the backend stores the student message as optional
 * free text, then any answers as `Question: <q>\nAnswer: <a>` blocks
 * separated by blank lines. A block that starts with `Question: ` and
 * contains `\nAnswer: ` becomes a pair (question is the text after
 * `Question: ` up to `\nAnswer: `, answer is everything after
 * `Answer: `). Every other block stays as body text, rejoined with
 * blank lines. Non-string input returns an empty result.
 */
export function parseStudentMessage(content: unknown): ParsedStudentMessage {
  const empty: ParsedStudentMessage = { body: "", pairs: [] };
  if (typeof content !== "string") return empty;
  if (content.length === 0) return empty;

  const normalized = content.replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/);

  const bodyParts: string[] = [];
  const pairs: StudentAnswerPair[] = [];

  for (const raw of blocks) {
    const block = raw.trim();
    if (block.length === 0) continue;

    if (block.startsWith("Question: ")) {
      const answerIdx = block.indexOf("\nAnswer: ");
      if (answerIdx >= 0) {
        const question = block.slice("Question: ".length, answerIdx).trim();
        const answer = block.slice(answerIdx + "\nAnswer: ".length).trim();
        pairs.push({ question, answer });
        continue;
      }
    }

    bodyParts.push(block);
  }

  return {
    body: bodyParts.join("\n\n"),
    pairs,
  };
}
