import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { ClubProfileView } from "./club-profile-view";
import { makeClubProfile, makeEvent } from "./test-fixtures";

afterEach(() => cleanup());

describe("ClubProfileView", () => {
  it("shows the header, stats, audience, about and events", () => {
    render(<ClubProfileView profile={makeClubProfile()} />);
    expect(screen.getByRole("heading", { level: 1, name: "Data Science Club" })).toBeInTheDocument();
    expect(screen.getByText("DS")).toBeInTheDocument();
    expect(screen.getByText("Learn by building")).toBeInTheDocument();
    expect(screen.getByText("BUET · Dhaka")).toBeInTheDocument();
    expect(screen.getByText("Founded 2018")).toBeInTheDocument();
    expect(screen.getByText("Members").nextElementSibling).toHaveTextContent("120");
    const fields = screen.getByRole("list", { name: "Fields of study" });
    expect(within(fields).getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("Years: Year 1, Year 2, Year 3")).toBeInTheDocument();
    expect(screen.getByText(/weekly data sessions/)).toBeInTheDocument();
    const event = screen.getByRole("article");
    expect(event).toHaveTextContent("Data Night");
    expect(event).toHaveTextContent("Monthly");
    expect(event).toHaveTextContent("Typically 80 people");
    expect(event).toHaveTextContent("A monthly evening of talks and demos.");
    expect(event).toHaveTextContent("Venue");
    expect(event).toHaveTextContent("Food and drink");
  });

  it("is friendly to a brand new club", () => {
    render(
      <ClubProfileView
        headingAs="h2"
        profile={makeClubProfile({
          tagline: null,
          city: null,
          foundedYear: null,
          memberCount: 0,
          audience: { fieldsOfStudy: [], years: [] },
          events: [],
        })}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Data Science Club" })).toBeInTheDocument();
    expect(screen.getByText("No events listed yet.")).toBeInTheDocument();
    expect(screen.getAllByText("Not listed yet.")).toHaveLength(2);
    expect(screen.queryByText(/Founded/)).not.toBeInTheDocument();
  });

  it("uses the friendly frequency label and singular attendance", () => {
    render(
      <ClubProfileView
        profile={makeClubProfile({
          events: [
            makeEvent({ id: "a", frequency: "Termly", typicalAttendance: 1, description: null, supportNeeds: [] }),
          ],
        })}
      />,
    );
    const event = screen.getByRole("article");
    expect(event).toHaveTextContent("Every term");
    expect(event).toHaveTextContent("Typically 1 person");
    expect(event).not.toHaveTextContent("Support needed");
  });
});
