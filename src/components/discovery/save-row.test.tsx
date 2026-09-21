import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { SaveRow } from "./save-row";

/**
 * Tests for the Save row. Pins:
 *   - The button is disabled when nothing is dirty.
 *   - The button is disabled while saving.
 *   - Clicking the enabled button calls onSave.
 *   - The right-hand status text reflects dirty / saved / form error.
 */

describe("SaveRow", () => {
  it("disables the Save button when nothing is dirty", () => {
    render(
      <SaveRow
        dirty={false}
        saving={false}
        savedOnce={true}
        formError={null}
        onSave={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Save changes/i }),
    ).toBeDisabled();
    expect(screen.getByText("All changes saved.")).toBeInTheDocument();
  });

  it("enables Save when dirty and calls onSave on click", () => {
    const onSave = vi.fn();
    render(
      <SaveRow
        dirty={true}
        saving={false}
        savedOnce={true}
        formError={null}
        onSave={onSave}
      />,
    );
    const btn = screen.getByRole("button", { name: /Save changes/i });
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("disables Save and shows 'Saving…' while saving", () => {
    render(
      <SaveRow
        dirty={true}
        saving={true}
        savedOnce={true}
        formError={null}
        onSave={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /Saving/i }),
    ).toBeDisabled();
  });

  it("shows the form-level error with role=alert instead of the dirty text", () => {
    render(
      <SaveRow
        dirty={true}
        saving={false}
        savedOnce={true}
        formError="Could not save your changes. Try again."
        onSave={vi.fn()}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(
      "Could not save your changes. Try again.",
    );
  });
});
