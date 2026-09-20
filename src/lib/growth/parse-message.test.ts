import { describe, expect, it } from "vitest";

import { parseStudentMessage, splitParagraphs } from "./parse-message";

describe("parseStudentMessage", () => {
  it("returns an empty result for an empty string", () => {
    expect(parseStudentMessage("")).toEqual({ body: "", pairs: [] });
  });

  it("returns an empty result for non-string input (defensive)", () => {
    expect(parseStudentMessage(null)).toEqual({ body: "", pairs: [] });
    expect(parseStudentMessage(undefined)).toEqual({ body: "", pairs: [] });
    expect(parseStudentMessage(123)).toEqual({ body: "", pairs: [] });
  });

  it("returns body only when there are no Question/Answer blocks", () => {
    expect(parseStudentMessage("Just some free text.")).toEqual({
      body: "Just some free text.",
      pairs: [],
    });
  });

  it("returns pairs only when the message is all answers", () => {
    expect(
      parseStudentMessage(
        [
          "Question: What's the goal?",
          "Answer: Win a hackathon",
          "",
          "Question: Who do you work with?",
          "Answer: Friends from class",
        ].join("\n"),
      ),
    ).toEqual({
      body: "",
      pairs: [
        { question: "What's the goal?", answer: "Win a hackathon" },
        { question: "Who do you work with?", answer: "Friends from class" },
      ],
    });
  });

  it("combines a body section with two answer pairs", () => {
    expect(
      parseStudentMessage(
        [
          "Some intro text.",
          "",
          "Question: Pick one",
          "Answer: Alpha",
          "",
          "Question: Pick two",
          "Answer: Beta",
        ].join("\n"),
      ),
    ).toEqual({
      body: "Some intro text.",
      pairs: [
        { question: "Pick one", answer: "Alpha" },
        { question: "Pick two", answer: "Beta" },
      ],
    });
  });

  it("treats a 'Question: ' block without 'Answer: ' as body", () => {
    expect(
      parseStudentMessage(
        ["Question: Just asking", "no answer line here"].join("\n"),
      ),
    ).toEqual({
      body: "Question: Just asking\nno answer line here",
      pairs: [],
    });
  });

  it("preserves multi-line answers", () => {
    expect(
      parseStudentMessage(
        [
          "Question: Pick one",
          "Answer: Alpha",
          "extra line",
          "and another",
        ].join("\n"),
      ),
    ).toEqual({
      body: "",
      pairs: [
        { question: "Pick one", answer: "Alpha\nextra line\nand another" },
      ],
    });
  });

  it("normalizes CRLF before splitting into pairs", () => {
    expect(
      parseStudentMessage(
        ["Question: Pick one", "Answer: Alpha"].join("\r\n"),
      ),
    ).toEqual({
      body: "",
      pairs: [{ question: "Pick one", answer: "Alpha" }],
    });
  });

  it("rejoins multiple body blocks with blank lines", () => {
    expect(
      parseStudentMessage(
        ["First paragraph.", "", "Second paragraph."].join("\n"),
      ),
    ).toEqual({
      body: "First paragraph.\n\nSecond paragraph.",
      pairs: [],
    });
  });
});

describe("splitParagraphs", () => {
  it("returns an empty array for an empty string", () => {
    expect(splitParagraphs("")).toEqual([]);
  });

  it("returns an empty array for non-string input (defensive)", () => {
    expect(splitParagraphs(null)).toEqual([]);
    expect(splitParagraphs(undefined)).toEqual([]);
    expect(splitParagraphs(123)).toEqual([]);
  });

  it("keeps single newlines inside a paragraph (does not collapse them)", () => {
    expect(splitParagraphs("Line one.\nLine two.")).toEqual([
      "Line one.\nLine two.",
    ]);
  });

  it("splits on blank lines", () => {
    expect(splitParagraphs("First paragraph.\n\nSecond paragraph.")).toEqual([
      "First paragraph.",
      "Second paragraph.",
    ]);
  });

  it("trims leading and trailing whitespace on each paragraph", () => {
    expect(splitParagraphs("   spaced   \n\n   also spaced   ")).toEqual([
      "spaced",
      "also spaced",
    ]);
  });

  it("drops empty paragraphs from leading/trailing blank lines", () => {
    expect(splitParagraphs("\n\nReal content.\n\n")).toEqual([
      "Real content.",
    ]);
  });

  it("normalizes CRLF before splitting", () => {
    expect(splitParagraphs("One.\r\n\r\nTwo.")).toEqual(["One.", "Two."]);
  });
});
