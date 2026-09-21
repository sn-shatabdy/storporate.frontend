import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ApiError } from "@/lib/api/errors";

import { GoalForm } from "./goal-form";
import { valuesFromGoalSet } from "./sponsorship-helpers";
import { makeGoalSet } from "./test-fixtures";

const onSubmit = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  onSubmit.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

function renderForm(props: Partial<React.ComponentProps<typeof GoalForm>> = {}) {
  return render(
    <GoalForm
      submitLabel="Create goal set"
      cancelHref="/employer/sponsorship"
      onSubmit={onSubmit}
      {...props}
    />,
  );
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function addTag(label: string, value: string) {
  const input = screen.getByLabelText(label);
  fireEvent.change(input, { target: { value } });
  fireEvent.keyDown(input, { key: "Enter" });
}

function fillBasics() {
  type("Goal set name", "Campus hiring");
  type("Company name", "Acme Ltd");
  fireEvent.click(screen.getByRole("button", { name: "Recruiting" }));
  fireEvent.click(screen.getByRole("button", { name: "Hackathon" }));
}

describe("GoalForm validation", () => {
  it("shows field errors and focuses the first invalid field", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));
    expect(screen.getByText(/Enter a name of 2 to 100/)).toBeInTheDocument();
    expect(screen.getByText(/Enter a company name/)).toBeInTheDocument();
    expect(screen.getByText("Pick at least one objective.")).toBeInTheDocument();
    expect(screen.getByText("Pick at least one kind of event.")).toBeInTheDocument();
    expect(screen.getByLabelText("Goal set name")).toHaveFocus();
    expect(screen.getByLabelText("Goal set name")).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires an audience and focuses the first audience box", () => {
    renderForm();
    fillBasics();
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));
    expect(
      screen.getByText("Add at least one field of study, year, city or university."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Fields of study")).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("accepts a year alone as the audience", () => {
    renderForm();
    fillBasics();
    fireEvent.click(screen.getByRole("button", { name: "Year 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("rejects a maximum below the minimum", () => {
    renderForm();
    fillBasics();
    addTag("Fields of study", "Design");
    type("Minimum (BDT)", "9000");
    type("Maximum (BDT)", "1000");
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));
    expect(screen.getByText("The maximum must be at least the minimum.")).toBeInTheDocument();
    expect(screen.getByLabelText("Maximum (BDT)")).toHaveFocus();
  });

  it("stops picking objectives at six", () => {
    renderForm();
    for (const name of [
      "Brand awareness",
      "Recruiting",
      "CSR education",
      "Community outreach",
      "Product launch",
      "Other",
    ]) {
      fireEvent.click(screen.getByRole("button", { name: name }));
    }
    expect(screen.getByText(/6 selected/)).toBeInTheDocument();
  });
});

describe("GoalForm submit", () => {
  it("sends the full payload", async () => {
    renderForm();
    fillBasics();
    addTag("Fields of study", "Computer Science");
    addTag("Cities", "Dhaka");
    addTag("Universities", "BUET");
    fireEvent.click(screen.getByRole("button", { name: "Year 4" }));
    fireEvent.click(screen.getByRole("button", { name: "Year 3" }));
    type("Minimum (BDT)", "50000");
    type("Maximum (BDT)", "200000");
    fireEvent.click(screen.getByRole("switch", { name: "Show budget range to clubs" }));
    type("Notes for clubs", "  Mentors available  ");
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Campus hiring",
      companyName: "Acme Ltd",
      objectives: ["Recruiting"],
      audience: {
        fieldsOfStudy: ["Computer Science"],
        years: [3, 4],
        cities: ["Dhaka"],
        universities: ["BUET"],
      },
      eventKinds: ["Hackathon"],
      budget: { min: 50000, max: 200000, visibleToClubs: true },
      notes: "Mentors available",
    });
  });

  it("keeps the budget switch off by default and sends null budget when empty", async () => {
    renderForm();
    expect(screen.getByRole("switch", { name: "Show budget range to clubs" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    fillBasics();
    addTag("Fields of study", "Design");
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].budget).toEqual({
      min: null,
      max: null,
      visibleToClubs: false,
    });
    expect(onSubmit.mock.calls[0][0].notes).toBeNull();
  });

  it("takes a half typed field of study along", async () => {
    renderForm();
    fillBasics();
    fireEvent.change(screen.getByLabelText("Fields of study"), { target: { value: "Marketing" } });
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0].audience.fieldsOfStudy).toEqual(["Marketing"]);
  });

  it("announces Saved. after a successful save", async () => {
    renderForm();
    fillBasics();
    addTag("Fields of study", "Design");
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved."));
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("shows the server message in an alert when the save fails", async () => {
    onSubmit.mockRejectedValue(
      new ApiError("sponsorship_goal_name_invalid", "That name is taken.", 400),
    );
    renderForm();
    fillBasics();
    addTag("Fields of study", "Design");
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That name is taken.");
  });

  it("shows a plain sentence for a network failure", async () => {
    onSubmit.mockRejectedValue(new Error("offline"));
    renderForm();
    fillBasics();
    addTag("Fields of study", "Design");
    fireEvent.click(screen.getByRole("button", { name: "Create goal set" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Could not save the goal set/);
  });
});

describe("GoalForm edit", () => {
  it("fills every field from an existing goal set", () => {
    renderForm({ initialValues: valuesFromGoalSet(makeGoalSet()), submitLabel: "Save changes" });
    expect(screen.getByLabelText("Goal set name")).toHaveValue("Campus hiring");
    expect(screen.getByLabelText("Company name")).toHaveValue("Acme Ltd");
    expect(screen.getByRole("button", { name: "Recruiting" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Workshop" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Year 3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Minimum (BDT)")).toHaveValue(50000);
    expect(screen.getByRole("switch", { name: "Show budget range to clubs" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByLabelText("Notes for clubs")).toHaveValue("We can send mentors.");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
  });
});
