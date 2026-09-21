import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { RequestProgress } from "./request-progress";

afterEach(() => cleanup());

function steps() {
  return within(screen.getByRole("list", { name: "Request progress" })).getAllByRole("listitem");
}

describe("RequestProgress", () => {
  it("lists the five steps in order", () => {
    render(<RequestProgress status="Sent" />);
    expect(steps().map((li) => li.textContent?.replace(/^(Done|Current step|Upcoming): /, ""))).toEqual([
      "Sent",
      "Viewed",
      "In discussion",
      "Agreed",
      "Completed",
    ]);
  });

  it("marks only the current step with aria-current", () => {
    render(<RequestProgress status="InDiscussion" />);
    const items = steps();
    expect(items.map((li) => li.getAttribute("aria-current"))).toEqual([null, null, "step", null, null]);
    expect(items.map((li) => li.getAttribute("data-state"))).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
    ]);
  });

  it("marks the last step current when Completed", () => {
    render(<RequestProgress status="Completed" />);
    const items = steps();
    expect(items[4]).toHaveAttribute("aria-current", "step");
    expect(items.slice(0, 4).every((li) => li.getAttribute("data-state") === "done")).toBe(true);
  });

  it("ends the track at Declined", () => {
    render(<RequestProgress status="Declined" />);
    const items = steps();
    expect(items).toHaveLength(3);
    expect(items[2]).toHaveTextContent("Declined");
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(screen.queryByText("Agreed")).not.toBeInTheDocument();
  });

  it("shows dates for reached steps only", () => {
    render(
      <RequestProgress
        status="Viewed"
        dates={{ Sent: "2026-09-18T10:00:00Z", Viewed: "2026-09-19T10:00:00Z", Agreed: "2026-09-25T10:00:00Z" }}
      />,
    );
    const items = steps();
    expect(items[0]).toHaveTextContent("Sep 18, 2026");
    expect(items[1]).toHaveTextContent("Sep 19, 2026");
    expect(items[3]).not.toHaveTextContent("2026");
  });
});
