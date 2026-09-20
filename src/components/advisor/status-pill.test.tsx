import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import {
  CONFIDENCE_BAND_STYLES,
  EXPLORATION_STATUS_STYLES,
  TITLE_CHIP_STYLE,
  VERSION_BADGE_STYLES,
} from "@/lib/growth/status-style";

import { StatusPill, StatusPillForStatus } from "./status-pill";

/**
 * Tests for the shared StatusPill component: every variant renders the
 * right label, colors, and icon presence (working + failed have an
 * icon; version, developing, missing, chip have none); the working
 * variant spins via `animate-spin`.
 */

describe("StatusPill — variants", () => {
  it("working renders the Working… label, the working-blue palette, and a spinning icon", () => {
    const workingStyle = EXPLORATION_STATUS_STYLES.Working;
    const { container } = render(<StatusPill variant="working" />);
    const pill = screen.getByTestId("status-pill-working");
    expect(pill).toHaveTextContent(workingStyle.label);
    expect(pill).toHaveStyle({
      backgroundColor: workingStyle.background,
      color: workingStyle.color,
    });
    // The working variant must render a spinning Loader2 icon.
    const icon = pill.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon!.className.baseVal).toContain("animate-spin");
    // The pill uses the shared base classes.
    expect(pill.className).toContain("inline-flex");
    expect(pill.className).toContain("rounded-full");
    expect(pill.className).toContain("px-2.5");
    expect(pill.className).toContain("py-[3px]");
    expect(pill.className).toContain("text-xs");
    expect(pill.className).toContain("whitespace-nowrap");
    // Container present.
    expect(container).toBeTruthy();
  });

  it("failed renders the Failed label, the destructive palette, and an AlertTriangle icon", () => {
    const failedStyle = EXPLORATION_STATUS_STYLES.Failed;
    render(<StatusPill variant="failed" />);
    const pill = screen.getByTestId("status-pill-failed");
    expect(pill).toHaveTextContent(failedStyle.label);
    expect(pill).toHaveStyle({
      backgroundColor: failedStyle.background,
      color: failedStyle.color,
    });
    // Has an icon (AlertTriangle) — must NOT have the spin class.
    const icon = pill.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon!.className.baseVal).not.toContain("animate-spin");
  });

  it("version renders the 'Version' label, the muted-yellow palette, and no icon", () => {
    const versionStyle = VERSION_BADGE_STYLES.Older;
    render(<StatusPill variant="version" label="Version 2" />);
    const pill = screen.getByTestId("status-pill-version");
    expect(pill).toHaveTextContent("Version 2");
    expect(pill).toHaveStyle({
      backgroundColor: versionStyle.background,
      color: versionStyle.color,
    });
    expect(pill.querySelector("svg")).toBeNull();
  });

  it("developing renders the Developing label, the warm palette, and no icon", () => {
    const devStyle = CONFIDENCE_BAND_STYLES.Developing;
    render(<StatusPill variant="developing" />);
    const pill = screen.getByTestId("status-pill-developing");
    expect(pill).toHaveTextContent(devStyle.label);
    expect(pill).toHaveStyle({
      backgroundColor: devStyle.background,
      color: devStyle.color,
    });
    expect(pill.querySelector("svg")).toBeNull();
  });

  it("missing renders the Missing label, the destructive palette, and no icon", () => {
    const missingStyle = CONFIDENCE_BAND_STYLES.Missing;
    render(<StatusPill variant="missing" />);
    const pill = screen.getByTestId("status-pill-missing");
    expect(pill).toHaveTextContent(missingStyle.label);
    expect(pill).toHaveStyle({
      backgroundColor: missingStyle.background,
      color: missingStyle.color,
    });
    expect(pill.querySelector("svg")).toBeNull();
  });

  it("chip renders the working-blue palette for the children content and no icon", () => {
    render(
      <StatusPill variant="chip">
        <span>Systems programming</span>
      </StatusPill>,
    );
    const pill = screen.getByTestId("status-pill-chip");
    expect(pill).toHaveTextContent("Systems programming");
    expect(pill).toHaveStyle({
      backgroundColor: TITLE_CHIP_STYLE.background,
      color: TITLE_CHIP_STYLE.color,
    });
    expect(pill.querySelector("svg")).toBeNull();
  });
});

describe("StatusPillForStatus", () => {
  it("Working renders a working pill with the working-blue palette and a spinner icon", () => {
    render(<StatusPillForStatus status="Working" />);
    const pill = screen.getByTestId("status-pill-working");
    expect(pill).toBeInTheDocument();
    expect(pill.querySelector("svg")).not.toBeNull();
  });

  it("Failed renders the failed pill with an icon", () => {
    render(<StatusPillForStatus status="Failed" />);
    const pill = screen.getByTestId("status-pill-failed");
    expect(pill).toBeInTheDocument();
    expect(pill.querySelector("svg")).not.toBeNull();
  });

  it("Idle renders nothing (no pill for up-to-date rows)", () => {
    const { container } = render(<StatusPillForStatus status="Idle" />);
    expect(container.firstChild).toBeNull();
  });
});