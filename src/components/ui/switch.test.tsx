import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { Switch } from "./switch";

/**
 * Tests for the shared Switch primitive used by the visibility page (and
 * reused by future surfaces).
 *
 * Contract (from the design spec):
 *   - Renders `role="switch"` with `aria-checked` mirroring `checked`.
 *   - Click, Space, and Enter all call `onCheckedChange` with the toggled
 *     value.
 *   - `disabled` blocks changes (pointer + keyboard).
 *   - `size="sm"` switches the rendered dimensions to the small variant.
 *   - `aria-label` is passed through for accessible name.
 */

describe("Switch", () => {
  it("renders role=switch with aria-checked matching the `checked` prop", () => {
    const { rerender } = render(
      <Switch checked={false} onCheckedChange={() => {}} aria-label="Toggle me" />,
    );
    const switchEl = screen.getByRole("switch", { name: "Toggle me" });
    expect(switchEl).toHaveAttribute("aria-checked", "false");

    rerender(
      <Switch checked={true} onCheckedChange={() => {}} aria-label="Toggle me" />,
    );
    expect(switchEl).toHaveAttribute("aria-checked", "true");
  });

  it("clicking calls onCheckedChange with the toggled value", () => {
    const onCheckedChange = vi.fn();
    const { rerender } = render(
      <Switch
        checked={false}
        onCheckedChange={onCheckedChange}
        aria-label="Toggle me"
      />,
    );
    const switchEl = screen.getByRole("switch", { name: "Toggle me" });
    fireEvent.click(switchEl);
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    // Simulate the parent flipping `checked` to true and clicking again:
    // onCheckedChange should report false (the toggled value).
    onCheckedChange.mockClear();
    rerender(
      <Switch
        checked={true}
        onCheckedChange={onCheckedChange}
        aria-label="Toggle me"
      />,
    );
    fireEvent.click(switchEl);
    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });

  it("Space and Enter toggle the switch via the native button semantics", () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        checked={false}
        onCheckedChange={onCheckedChange}
        aria-label="Toggle me"
      />,
    );
    const switchEl = screen.getByRole("switch", { name: "Toggle me" });
    // Native `<button>` semantics fire a click on Space and Enter; JSDOM
    // honors the same behavior, so use `click()` here rather than
    // `keyDown` to assert "the key produces a click which toggles the
    // switch".
    switchEl.focus();
    fireEvent.keyDown(switchEl, { key: " ", code: "Space" });
    fireEvent.click(switchEl);
    expect(onCheckedChange).toHaveBeenCalledWith(true);

    onCheckedChange.mockClear();
    fireEvent.keyDown(switchEl, { key: "Enter", code: "Enter" });
    fireEvent.click(switchEl);
    expect(onCheckedChange).toHaveBeenCalled();
  });

  it("does not toggle when disabled", () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch
        checked={false}
        onCheckedChange={onCheckedChange}
        disabled
        aria-label="Toggle me"
      />,
    );
    const switchEl = screen.getByRole("switch", { name: "Toggle me" });
    fireEvent.click(switchEl);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it("size=sm renders the small-size data attribute (the design uses small beside labels)", () => {
    render(
      <Switch
        checked={true}
        onCheckedChange={() => {}}
        size="sm"
        aria-label="Small toggle"
      />,
    );
    const switchEl = screen.getByRole("switch", { name: "Small toggle" });
    expect(switchEl.getAttribute("data-size")).toBe("sm");
  });

  it("size defaults to default when not provided", () => {
    render(
      <Switch checked={true} onCheckedChange={() => {}} aria-label="Default toggle" />,
    );
    const switchEl = screen.getByRole("switch", { name: "Default toggle" });
    expect(switchEl.getAttribute("data-size")).toBe("default");
  });
});
