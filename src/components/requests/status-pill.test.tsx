import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { REQUEST_STATUSES } from "@/lib/api/sponsorshipRequests";

import { RequestStatusPill } from "./status-pill";

afterEach(() => cleanup());

const LABELS: Record<string, string> = {
  Sent: "Sent",
  Viewed: "Viewed",
  InDiscussion: "In discussion",
  Agreed: "Agreed",
  Declined: "Declined",
  Completed: "Completed",
};

describe("RequestStatusPill", () => {
  it.each(REQUEST_STATUSES)("shows text for %s", (status) => {
    render(<RequestStatusPill status={status} />);
    expect(screen.getByText(LABELS[status])).toBeInTheDocument();
  });

  it("uses the agreed colours for Agreed and Declined", () => {
    const { rerender } = render(<RequestStatusPill status="Agreed" />);
    expect(screen.getByText("Agreed")).toHaveStyle({ backgroundColor: "#e6f4ea", color: "#1e7b34" });
    rerender(<RequestStatusPill status="Declined" />);
    expect(screen.getByText("Declined")).toHaveStyle({ backgroundColor: "#fbeee7", color: "#a4460f" });
  });

  it("gives Sent and Viewed the neutral tint and In discussion the primary tint", () => {
    const { rerender } = render(<RequestStatusPill status="Sent" />);
    expect(screen.getByText("Sent")).toHaveStyle({ backgroundColor: "#f3efdd" });
    rerender(<RequestStatusPill status="Viewed" />);
    expect(screen.getByText("Viewed")).toHaveStyle({ backgroundColor: "#f3efdd" });
    rerender(<RequestStatusPill status="InDiscussion" />);
    expect(screen.getByText("In discussion")).toHaveStyle({ backgroundColor: "#e7f0ed" });
  });

  it("adds a check icon only for Completed", () => {
    const { container, rerender } = render(<RequestStatusPill status="Completed" />);
    expect(container.querySelector("svg")).not.toBeNull();
    rerender(<RequestStatusPill status="Agreed" />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
