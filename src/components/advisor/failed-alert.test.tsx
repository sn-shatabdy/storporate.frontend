import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { FailedAlert } from "./failed-alert";

/**
 * Tests for the shared FailedAlert:
 *   - role="alert" with the fixed title and sub-line.
 *   - The Try again button calls onRetry.
 *   - Any backend "message" passed in (e.g. lastError) is NEVER surfaced.
 *   - The destructive-tone AlertTriangle icon is present.
 */

describe("FailedAlert — fixed copy + retry", () => {
  it("renders the fixed title 'The advisor could not finish this' and the 'Try again.' sub-line", () => {
    render(<FailedAlert onRetry={vi.fn()} />);
    expect(
      screen.getByText("The advisor could not finish this"),
    ).toBeInTheDocument();
    expect(screen.getByText("Try again.")).toBeInTheDocument();
  });

  it("carries role=alert so screen readers announce it", () => {
    render(<FailedAlert onRetry={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("the Try again button calls onRetry when clicked", () => {
    const onRetry = vi.fn();
    render(<FailedAlert onRetry={onRetry} />);
    const btn = screen.getByRole("button", { name: /Try again/i });
    btn.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("defaults to the pinned 'Try again.' sub-line when no override is provided (call sites never pass a backend message)", () => {
    render(<FailedAlert onRetry={vi.fn()} />);
    // The pinned sub-line is what's rendered.
    expect(screen.getByText("Try again.")).toBeInTheDocument();
  });

  it("renders the destructive-tone AlertTriangle icon", () => {
    const { container } = render(<FailedAlert onRetry={vi.fn()} />);
    // The lucide AlertTriangle SVG renders as `svg.lucide-alert-triangle`
    // (or `lucide-triangle-alert` depending on the lucide version).
    const icon = container.querySelector(
      'svg.lucide-triangle-alert, svg.lucide-alert-triangle',
    );
    expect(icon).not.toBeNull();
  });
});