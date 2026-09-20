import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import type {
  ExplorationDetail,
  ExplorationGap,
  ExplorationSuggestion,
  ExplorationSummary,
} from "@/lib/api/growth";

import { Section, SummaryPanel, isSafeExternalUrl } from "./advisor-summary";

/**
 * Tests for the extracted SummaryPanel + Section. Verifies:
 *   - 2 gaps + 3 suggestions render exactly 2 gap cards / 3 suggestion
 *     cards.
 *   - Developing + Missing pills show on the right gaps; a gap with no
 *     band renders NO pill at all.
 *   - Change note shows only when present.
 *   - Suggestion with source renders the link with the correct href +
 *     target=_blank + rel attrs.
 *   - Section with zero items is not rendered at all.
 *   - When no summary exists, the empty placeholder copy shows.
 *   - When the exploration is Working + a summary exists, the header
 *     pill is "Updating…" (not "Version N") and the dashed updating box
 *     from Phase 4 is gone (no animated bars in the summary aside).
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

function makeGap(overrides: Partial<ExplorationGap> = {}): ExplorationGap {
  return {
    title: "A gap",
    detail: "Gap detail.",
    band: null,
    ...overrides,
  };
}

function makeSuggestion(
  overrides: Partial<ExplorationSuggestion> = {},
): ExplorationSuggestion {
  return {
    title: "A suggestion",
    reason: "A reason.",
    nextStep: "A next step.",
    source: null,
    ...overrides,
  };
}

function makeSummary(
  overrides: Partial<ExplorationSummary> = {},
): ExplorationSummary {
  return {
    versionNumber: 1,
    createdAt: "2026-09-19T15:00:00Z",
    changeNote: null,
    gaps: [],
    suggestions: [],
    ...overrides,
  };
}

describe("SummaryPanel — cards render in proportion to gaps/suggestions", () => {
  it("renders exactly 2 gap cards and 3 suggestion cards with the matching band pills", () => {
    const detail = makeDetail({
      latestSummary: makeSummary({
        versionNumber: 2,
        gaps: [
          makeGap({ title: "Gap one", band: "Developing" }),
          makeGap({ title: "Gap two", band: "Missing" }),
        ],
        suggestions: [
          makeSuggestion({ title: "Sug one" }),
          makeSuggestion({ title: "Sug two" }),
          makeSuggestion({ title: "Sug three" }),
        ],
      }),
    });

    render(<SummaryPanel detail={detail} isWorking={false} />);

    // Two gap cards. The gap card container is the rounded-2xl aside
    // section that holds both the title and detail. We scope to the
    // "Gaps" section first so we don't pick up suggestion titles.
    const gapsSection = screen.getByRole("region", {
      name: "Gaps",
    });
    expect(gapsSection).toBeInTheDocument();
    expect(within(gapsSection).getByText("Gap one")).toBeInTheDocument();
    expect(within(gapsSection).getByText("Gap two")).toBeInTheDocument();
    // No third gap.
    expect(
      within(gapsSection).queryByText("Gap three"),
    ).not.toBeInTheDocument();

    // Three suggestion cards.
    const suggestionsSection = screen.getByRole("region", {
      name: "Suggestions",
    });
    expect(within(suggestionsSection).getByText("Sug one")).toBeInTheDocument();
    expect(within(suggestionsSection).getByText("Sug two")).toBeInTheDocument();
    expect(within(suggestionsSection).getByText("Sug three")).toBeInTheDocument();

    // Band pills appear in the gaps section only.
    expect(
      within(gapsSection).getByTestId("status-pill-developing"),
    ).toBeInTheDocument();
    expect(
      within(gapsSection).getByTestId("status-pill-missing"),
    ).toBeInTheDocument();

    // The numbered badges 1/2/3 appear in the suggestions section.
    // (We use getAllByText because the section heading row also renders
    // the count number; the per-suggestion badge is at least one match.)
    expect(within(suggestionsSection).getAllByText("1").length).toBeGreaterThanOrEqual(1);
    expect(within(suggestionsSection).getAllByText("2").length).toBeGreaterThanOrEqual(1);
    expect(within(suggestionsSection).getAllByText("3").length).toBeGreaterThanOrEqual(1);
  });

  it("a gap without a band renders NO band pill on that row", () => {
    const detail = makeDetail({
      latestSummary: makeSummary({
        gaps: [
          makeGap({ title: "Bandless", band: null }),
          makeGap({ title: "Has band", band: "Developing" }),
        ],
        suggestions: [],
      }),
    });

    render(<SummaryPanel detail={detail} isWorking={false} />);

    const gapsSection = screen.getByRole("region", { name: "Gaps" });
    // Both gap titles render.
    expect(within(gapsSection).getByText("Bandless")).toBeInTheDocument();
    expect(within(gapsSection).getByText("Has band")).toBeInTheDocument();

    // Only one Developing pill total (the second gap carries it).
    expect(
      within(gapsSection).getAllByTestId("status-pill-developing"),
    ).toHaveLength(1);
    // No Missing pill.
    expect(
      within(gapsSection).queryByTestId("status-pill-missing"),
    ).not.toBeInTheDocument();
  });

  it("change note renders ONLY when present", () => {
    const without = makeDetail({
      latestSummary: makeSummary({
        changeNote: null,
        gaps: [],
        suggestions: [],
      }),
    });
    const { rerender } = render(<SummaryPanel detail={without} isWorking={false} />);
    // No banner — the body of the summary aside has no green Check icon.
    expect(document.querySelector("svg.lucide-check")).not.toBeInTheDocument();

    const withNote = makeDetail({
      latestSummary: makeSummary({
        changeNote: "Your portfolio improved in two areas.",
        gaps: [],
        suggestions: [],
      }),
    });
    rerender(<SummaryPanel detail={withNote} isWorking={false} />);
    expect(
      screen.getByText("Your portfolio improved in two areas."),
    ).toBeInTheDocument();
    // And the green check icon is present.
    expect(document.querySelector("svg.lucide-check")).toBeInTheDocument();
  });

  it("suggestion with source renders the link with href + target=_blank + rel=noopener noreferrer", () => {
    const detail = makeDetail({
      latestSummary: makeSummary({
        suggestions: [
          makeSuggestion({
            title: "Read about X",
            source: {
              feedItemId: "fi-1",
              title: "X — the deep dive",
              url: "https://example.com/x",
              sourceName: "Awesome Feed",
            },
          }),
          makeSuggestion({ title: "No source" }),
        ],
      }),
    });

    render(<SummaryPanel detail={detail} isWorking={false} />);

    const link = screen.getByRole("link", { name: /Awesome Feed: X — the deep dive/i });
    expect(link).toHaveAttribute("href", "https://example.com/x");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    // Suggestion without source has no link.
    expect(screen.getByText("No source")).toBeInTheDocument();
  });

  it("Section with zero items is NOT rendered", () => {
    const detail = makeDetail({
      latestSummary: makeSummary({
        gaps: [],
        suggestions: [],
      }),
    });

    render(<SummaryPanel detail={detail} isWorking={false} />);

    expect(screen.queryByRole("region", { name: "Gaps" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Suggestions" }),
    ).not.toBeInTheDocument();
  });

  it("no summary shows the empty placeholder copy", () => {
    render(<SummaryPanel detail={makeDetail()} isWorking={false} />);
    expect(screen.getByText("No summary yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Answer the questions. Your gaps and suggestions appear here.",
      ),
    ).toBeInTheDocument();
  });
});

describe("SummaryPanel — updating pill", () => {
  it("Working + summary shows the 'Updating…' pill in the header, NO 'Version N' pill, NO dashed updating box", () => {
    const detail = makeDetail({
      status: "Working",
      latestSummary: makeSummary({
        versionNumber: 3,
        gaps: [],
        suggestions: [],
      }),
    });

    render(<SummaryPanel detail={detail} isWorking={true} />);

    // The header pill is the "Updating…" StatusPill (working variant),
    // not the version pill.
    const updatingPill = screen.getByTestId("status-pill-working");
    expect(updatingPill).toHaveTextContent("Updating…");
    // No version pill in the DOM at all.
    expect(screen.queryByTestId("status-pill-version")).not.toBeInTheDocument();
    // No animated bars (the Phase 4 dashed updating box is removed).
    const animatedBars = document.querySelectorAll("div.h-3.rounded-md");
    expect(animatedBars.length).toBe(0);
  });

  it("Idle + summary shows the 'Version N' pill in the header", () => {
    const detail = makeDetail({
      status: "Idle",
      latestSummary: makeSummary({
        versionNumber: 4,
        gaps: [],
        suggestions: [],
      }),
    });

    render(<SummaryPanel detail={detail} isWorking={false} />);

    const versionPill = screen.getByTestId("status-pill-version");
    expect(versionPill).toHaveTextContent("Version 4");
    // No working pill.
    expect(screen.queryByTestId("status-pill-working")).not.toBeInTheDocument();
  });
});

describe("Section — heading row + items container", () => {
  it("renders the heading row (title + count) above the items container", () => {
    render(
      <Section
        title="Gaps"
        count={3}
        items={[
          { key: "1", node: <span>Card 1</span> },
          { key: "2", node: <span>Card 2</span> },
          { key: "3", node: <span>Card 3</span> },
        ]}
      />,
    );

    const section = screen.getByRole("region", { name: "Gaps" });
    // Heading row contains the title and the count.
    const headingRow = section.querySelector("div.flex.items-baseline");
    expect(headingRow).not.toBeNull();
    expect(within(headingRow as HTMLElement).getByText("Gaps")).toBeInTheDocument();
    expect(within(headingRow as HTMLElement).getByText("3")).toBeInTheDocument();

    // Items container renders all three nodes.
    expect(within(section).getByText("Card 1")).toBeInTheDocument();
    expect(within(section).getByText("Card 2")).toBeInTheDocument();
    expect(within(section).getByText("Card 3")).toBeInTheDocument();
  });
});

describe("isSafeExternalUrl — defense-in-depth protocol guard", () => {
  it("returns the URL for plain http and https", () => {
    expect(isSafeExternalUrl("https://example.com/x")).toBe(
      "https://example.com/x",
    );
    expect(isSafeExternalUrl("http://example.com/x")).toBe(
      "http://example.com/x",
    );
  });

  it("trims whitespace around an http(s) URL", () => {
    expect(isSafeExternalUrl("  https://example.com/x  ")).toBe(
      "https://example.com/x",
    );
  });

  it("returns null for javascript:, data:, and other dangerous schemes", () => {
    expect(isSafeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(isSafeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(isSafeExternalUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("returns null for empty/null/undefined", () => {
    expect(isSafeExternalUrl("")).toBeNull();
    expect(isSafeExternalUrl(null)).toBeNull();
    expect(isSafeExternalUrl(undefined)).toBeNull();
  });

  it("returns null for plain strings that don't have any scheme", () => {
    expect(isSafeExternalUrl("example.com/x")).toBeNull();
    expect(isSafeExternalUrl("/relative/path")).toBeNull();
  });
});