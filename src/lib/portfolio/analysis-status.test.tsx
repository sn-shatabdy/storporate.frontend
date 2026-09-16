import { describe, expect, it } from "vitest";

import {
  ANALYSIS_STATUS_STYLES,
  CONFIDENCE_BAND_STYLES,
  styleForAnalysisStatus,
  styleForConfidenceBand,
  type AnalysisStatus,
  type ConfidenceBand,
} from "./analysis-status";
import { Badge } from "@/components/ui/badge";
import { render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * Pins the approved design's exact hex pairs + labels for every status and
 * confidence band. Any accidental future tweak should fail this suite so a
 * reviewer (and the pixel-for-pixel sign-off) gets a loud signal rather
 * than a silent drift.
 *
 * First test of an entirely new test suite in this repo (STOR-38 Phase 5),
 * so the file is intentionally verbose / heavily commented — future phases
 * shouldn't have to re-derive the testing style from scratch.
 */

describe("ANALYSIS_STATUS_STYLES", () => {
  // The five entries expected by the approved design canvas.
  const expected: Array<
    [AnalysisStatus, string, string, string]
  > = [
    ["NotAnalyzed", "#f3efdd", "#6e6488", "Not analyzed"],
    ["Analyzing", "#e8eef2", "#345a73", "Analyzing…"],
    ["Analyzed", "#e6f4ea", "#1e7b34", "Analyzed"],
    ["Unsupported", "#f3efdd", "#6e6488", "Not supported"],
    ["Failed", "#fbe9e7", "#b3261e", "Analysis failed"],
  ];

  it.each(expected)(
    "%s — exact background, color, and label match the approved design",
    (status, background, color, label) => {
      const style = ANALYSIS_STATUS_STYLES[status];
      expect(style.background).toBe(background);
      expect(style.color).toBe(color);
      expect(style.label).toBe(label);
    },
  );

  it("every status entry has an icon component (LucideIcon)", () => {
    (Object.keys(ANALYSIS_STATUS_STYLES) as AnalysisStatus[]).forEach((status) => {
      const Icon = ANALYSIS_STATUS_STYLES[status].icon;
      // Lucide-react v1.45 ships icons as forwardRef objects — the type
      // is `object` from `typeof`'s perspective, not `function`. We just
      // want to make sure the field is set (not `undefined`) and is
      // callable as a React component by the list-row / detail-page
      // call sites — so assert it's defined and either a function itself
      // or has a `.render` function (forwardRef signature).
      expect(Icon).toBeDefined();
      expect(Icon).not.toBeNull();
      const isForwardRef =
        typeof Icon === "object" &&
        Icon !== null &&
        typeof (Icon as unknown as { render?: unknown }).render === "function";
      expect(isForwardRef || typeof Icon === "function").toBe(true);
    });
  });

  describe("styleForAnalysisStatus", () => {
    it("returns the matching entry for a known status", () => {
      expect(styleForAnalysisStatus("Analyzed").label).toBe("Analyzed");
      expect(styleForAnalysisStatus("Analyzing").background).toBe("#e8eef2");
    });

    it("falls back to NotAnalyzed for an unknown status", () => {
      expect(styleForAnalysisStatus("SomeFutureStatus").label).toBe(
        "Not analyzed",
      );
      expect(styleForAnalysisStatus("SomeFutureStatus").background).toBe(
        "#f3efdd",
      );
    });
  });
});

describe("CONFIDENCE_BAND_STYLES", () => {
  const expected: Array<
    [ConfidenceBand, string, string, string]
  > = [
    ["Strong", "#e6f4ea", "#1e7b34", "Strong"],
    ["Developing", "#fbeee7", "#a4460f", "Developing"],
    ["Missing", "#fbe9e7", "#b3261e", "Missing"],
  ];

  it.each(expected)(
    "%s — exact background, color, and label match the approved design",
    (band, background, color, label) => {
      const style = CONFIDENCE_BAND_STYLES[band];
      expect(style.background).toBe(background);
      expect(style.color).toBe(color);
      expect(style.label).toBe(label);
    },
  );

  describe("styleForConfidenceBand", () => {
    it("returns the matching entry for a known band", () => {
      expect(styleForConfidenceBand("Strong").label).toBe("Strong");
      expect(styleForConfidenceBand("Missing").background).toBe("#fbe9e7");
    });

    it("falls back to Missing for an unknown band", () => {
      expect(styleForConfidenceBand("SomeFutureBand").label).toBe("Missing");
      expect(styleForConfidenceBand("SomeFutureBand").color).toBe("#b3261e");
    });
  });
});

describe("Badge component renders the map values correctly", () => {
  it("applies the inline background/color from props", () => {
    render(
      <Badge background="#123456" color="#abcdef" data-testid="my-badge">
        Sample label
      </Badge>,
    );
    const el = screen.getByTestId("my-badge");
    expect(el).toHaveStyle({ backgroundColor: "#123456", color: "#abcdef" });
  });

  it("renders the Analyzed status's exact background + label via the map", () => {
    const style = ANALYSIS_STATUS_STYLES.Analyzed;
    const Icon = style.icon;
    render(
      <Badge background={style.background} color={style.color} data-testid="status-badge">
        <Icon data-testid="status-icon" />
        {style.label}
      </Badge>,
    );
    const el = screen.getByTestId("status-badge");
    expect(el).toHaveStyle({ backgroundColor: "#e6f4ea", color: "#1e7b34" });
    expect(el).toHaveTextContent("Analyzed");
  });

  it("renders the Failed status's exact background + label via the map", () => {
    const style = ANALYSIS_STATUS_STYLES.Failed;
    render(
      <Badge background={style.background} color={style.color} data-testid="failed-badge">
        {style.label}
      </Badge>,
    );
    expect(screen.getByTestId("failed-badge")).toHaveStyle({
      backgroundColor: "#fbe9e7",
      color: "#b3261e",
    });
    expect(screen.getByTestId("failed-badge")).toHaveTextContent(
      "Analysis failed",
    );
  });
});
