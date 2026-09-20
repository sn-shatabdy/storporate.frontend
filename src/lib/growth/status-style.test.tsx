import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import type {
  ExplorationStatus,
  GapBand,
} from "@/lib/api/growth";
import {
  CONFIDENCE_BAND_STYLES,
  EXPLORATION_STATUS_STYLES,
  TITLE_CHIP_STYLE,
  VERSION_BADGE_STYLES,
  styleForConfidenceBand,
  styleForExplorationStatus,
  styleForTitleChip,
  styleForVersionBadge,
  type VersionTone,
} from "./status-style";

/**
 * Pins the exact hex pairs + label strings the approved design canvas
 * prescribes for the advisor surface's status pills, version badges,
 * gap-band chips, and title chips. Same source-of-truth-and-test
 * discipline used in `src/lib/portfolio/analysis-status.test.tsx`.
 */

describe("EXPLORATION_STATUS_STYLES", () => {
  const expected: Array<[ExplorationStatus, string, string, string]> = [
    ["Working", "#e8eef2", "#345a73", "Working…"],
    ["Idle", "#e6f4ea", "#1e7b34", "Up to date"],
    ["Failed", "#fbe9e7", "#b3261e", "Failed"],
  ];

  it.each(expected)(
    "%s — exact background, color, and label match the approved design",
    (status, background, color, label) => {
      const style = EXPLORATION_STATUS_STYLES[status];
      expect(style.background).toBe(background);
      expect(style.color).toBe(color);
      expect(style.label).toBe(label);
    },
  );

  it("every entry has a defined LucideIcon component", () => {
    (Object.keys(EXPLORATION_STATUS_STYLES) as ExplorationStatus[]).forEach(
      (status) => {
        const Icon = EXPLORATION_STATUS_STYLES[status].icon;
        expect(Icon).toBeDefined();
        const isForwardRef =
          typeof Icon === "object" &&
          Icon !== null &&
          typeof (Icon as unknown as { render?: unknown }).render ===
            "function";
        expect(isForwardRef || typeof Icon === "function").toBe(true);
      },
    );
  });

  describe("styleForExplorationStatus", () => {
    it("returns the matching entry for a known status", () => {
      expect(styleForExplorationStatus("Working").label).toBe("Working…");
      expect(styleForExplorationStatus("Idle").background).toBe("#e6f4ea");
    });

    it("falls back to Idle for an unknown status", () => {
      expect(styleForExplorationStatus("SomeFutureStatus").label).toBe(
        "Up to date",
      );
      expect(styleForExplorationStatus("SomeFutureStatus").background).toBe(
        "#e6f4ea",
      );
    });
  });
});

describe("VERSION_BADGE_STYLES", () => {
  const expected: Array<[VersionTone, string, string, string]> = [
    ["Latest", "#e7f0ed", "#345a73", "Latest"],
    ["Older", "#f3efdd", "#6e6488", "Older"],
  ];

  it.each(expected)(
    "%s — exact background, color, and label match the approved design",
    (tone, background, color, label) => {
      const style = VERSION_BADGE_STYLES[tone];
      expect(style.background).toBe(background);
      expect(style.color).toBe(color);
      expect(style.label).toBe(label);
    },
  );

  describe("styleForVersionBadge", () => {
    it("returns the Latest style", () => {
      expect(styleForVersionBadge("Latest").label).toBe("Latest");
    });
    it("returns the Older style", () => {
      expect(styleForVersionBadge("Older").background).toBe("#f3efdd");
    });
  });
});

describe("CONFIDENCE_BAND_STYLES", () => {
  const expected: Array<[GapBand, string, string, string]> = [
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
    it("returns the Developing style", () => {
      expect(styleForConfidenceBand("Developing").color).toBe("#a4460f");
    });
    it("returns the Missing style", () => {
      expect(styleForConfidenceBand("Missing").background).toBe("#fbe9e7");
    });
    it("falls back to Developing for an unknown band", () => {
      expect(styleForConfidenceBand("Strong").label).toBe("Developing");
    });
  });
});

describe("TITLE_CHIP_STYLE", () => {
  it("exact background and color match the approved design", () => {
    expect(TITLE_CHIP_STYLE.background).toBe("#e7f0ed");
    expect(TITLE_CHIP_STYLE.color).toBe("#345a73");
  });

  describe("styleForTitleChip", () => {
    it("returns the working-blue chip style (no argument)", () => {
      expect(styleForTitleChip()).toEqual({
        background: "#e7f0ed",
        color: "#345a73",
      });
    });
  });
});

describe("Badge renders the status map entries correctly", () => {
  it("applies the Working pill's exact background + label", () => {
    const style = EXPLORATION_STATUS_STYLES.Working;
    render(
      <Badge
        background={style.background}
        color={style.color}
        data-testid="working-pill"
      >
        {style.label}
      </Badge>,
    );
    const el = screen.getByTestId("working-pill");
    expect(el).toHaveStyle({ backgroundColor: "#e8eef2", color: "#345a73" });
    expect(el).toHaveTextContent("Working…");
  });

  it("applies the Failed pill's exact background + label", () => {
    const style = EXPLORATION_STATUS_STYLES.Failed;
    render(
      <Badge
        background={style.background}
        color={style.color}
        data-testid="failed-pill"
      >
        {style.label}
      </Badge>,
    );
    const el = screen.getByTestId("failed-pill");
    expect(el).toHaveStyle({ backgroundColor: "#fbe9e7", color: "#b3261e" });
    expect(el).toHaveTextContent("Failed");
  });
});
