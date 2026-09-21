import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { FitBadge } from "./fit-badge";
import { ALL_BANDS } from "./test-fixtures";

afterEach(() => cleanup());

describe("FitBadge", () => {
  it("shows the band as a word with the word fit", () => {
    for (const band of ALL_BANDS) {
      render(<FitBadge fit={band} />);
      expect(screen.getByText(`${band} fit`)).toBeInTheDocument();
    }
  });

  it("uses the job fit pill colors", () => {
    const { rerender } = render(<FitBadge fit="Strong" />);
    expect(screen.getByText("Strong fit")).toHaveStyle({ color: "rgb(30, 123, 52)" });
    rerender(<FitBadge fit="Good" />);
    expect(screen.getByText("Good fit")).toHaveStyle({ color: "rgb(52, 90, 115)" });
    rerender(<FitBadge fit="Partial" />);
    expect(screen.getByText("Partial fit")).toHaveStyle({ color: "rgb(164, 70, 15)" });
  });

  it("never renders digits or percent signs", () => {
    for (const band of ALL_BANDS) {
      const { container } = render(<FitBadge fit={band} />);
      expect(container.textContent).not.toMatch(/[0-9%]/);
      cleanup();
    }
  });
});
