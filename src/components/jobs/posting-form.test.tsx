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

import { PostingForm } from "./posting-form";
import { addSkills } from "./posting-helpers";

const onSubmit = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  onSubmit.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

function renderForm() {
  return render(
    <PostingForm submitLabel="Post opening" cancelHref="/employer/jobs" onSubmit={onSubmit} />,
  );
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillValid() {
  type("Title", "Junior data analyst");
  type("Company name", "Acme Analytics");
  type("Description", "Build dashboards and clean sales data for the team.");
  const tags = screen.getByLabelText("Required skills");
  fireEvent.change(tags, { target: { value: "Power BI" } });
  fireEvent.keyDown(tags, { key: "Enter" });
}

describe("PostingForm validation", () => {
  it("shows inline errors, focuses the first invalid field, and does not submit", () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Post opening" }));
    expect(screen.getByText(/Enter a title of 3 to 120 characters/)).toBeInTheDocument();
    expect(screen.getByText(/Enter a company name/)).toBeInTheDocument();
    expect(screen.getByText(/Describe the opening in 20 to 4000/)).toBeInTheDocument();
    expect(screen.getByText("Add at least one required skill.")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveFocus();
    expect(screen.getByLabelText("Title")).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("focuses the first invalid field when only later fields are wrong", () => {
    renderForm();
    type("Title", "Junior data analyst");
    type("Company name", "Acme");
    fireEvent.click(screen.getByRole("button", { name: "Post opening" }));
    expect(screen.getByLabelText("Description")).toHaveFocus();
  });

  it("submits the trimmed request with kind, work mode and null location", async () => {
    renderForm();
    fillValid();
    fireEvent.click(screen.getByRole("radio", { name: "Internship" }));
    fireEvent.click(screen.getByRole("radio", { name: "Remote" }));
    fireEvent.click(screen.getByRole("button", { name: "Post opening" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      title: "Junior data analyst",
      kind: "Internship",
      companyName: "Acme Analytics",
      location: null,
      workMode: "Remote",
      description: "Build dashboards and clean sales data for the team.",
      requiredSkills: ["Power BI"],
    });
  });

  it("includes a half typed skill on submit", async () => {
    renderForm();
    type("Title", "Junior data analyst");
    type("Company name", "Acme Analytics");
    type("Description", "Build dashboards and clean sales data for the team.");
    type("Required skills", "Customer support");
    fireEvent.click(screen.getByRole("button", { name: "Post opening" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0].requiredSkills).toEqual(["Customer support"]);
  });

  it("shows a busy state while saving", async () => {
    let resolve: () => void = () => {};
    onSubmit.mockReturnValue(new Promise<void>((r) => (resolve = r)));
    renderForm();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Post opening" }));
    const busy = await screen.findByRole("button", { name: /Saving/ });
    expect(busy).toBeDisabled();
    resolve();
  });

  it("maps server errors to one sentence and re-enables the form", async () => {
    onSubmit.mockRejectedValue(new ApiError("job_posting_closed", "x", 409));
    renderForm();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Post opening" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This opening is closed, so it can no longer be changed.",
    );
    expect(screen.getByRole("button", { name: "Post opening" })).toBeEnabled();
  });

  it("shows the server message for a 400", async () => {
    onSubmit.mockRejectedValue(new ApiError("validation", "Title is too long.", 400));
    renderForm();
    fillValid();
    fireEvent.click(screen.getByRole("button", { name: "Post opening" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Title is too long.");
  });
});

describe("skills tag input", () => {
  it("adds on Enter and on comma, removes with the pill button", () => {
    renderForm();
    const tags = screen.getByLabelText("Required skills");
    fireEvent.change(tags, { target: { value: "Power BI" } });
    fireEvent.keyDown(tags, { key: "Enter" });
    fireEvent.change(tags, { target: { value: "Excel," } });
    expect(screen.getByRole("button", { name: "Remove Power BI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Excel" })).toBeInTheDocument();
    expect(tags).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Remove Power BI" }));
    expect(screen.queryByRole("button", { name: "Remove Power BI" })).not.toBeInTheDocument();
  });

  it("removes the last skill with Backspace on an empty box", () => {
    renderForm();
    const tags = screen.getByLabelText("Required skills");
    fireEvent.change(tags, { target: { value: "Power BI, Excel," } });
    fireEvent.keyDown(tags, { key: "Backspace" });
    expect(screen.queryByRole("button", { name: "Remove Excel" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Power BI" })).toBeInTheDocument();
  });

  it("ignores duplicates regardless of case and does not submit on Enter", () => {
    renderForm();
    const tags = screen.getByLabelText("Required skills");
    fireEvent.change(tags, { target: { value: "Excel," } });
    fireEvent.change(tags, { target: { value: "excel" } });
    fireEvent.keyDown(tags, { key: "Enter" });
    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("caps at 12 skills and tells the person", () => {
    renderForm();
    const tags = screen.getByLabelText("Required skills");
    const names = Array.from({ length: 12 }, (_, i) => `Skill ${String.fromCharCode(65 + i)}`);
    fireEvent.change(tags, { target: { value: names.join(",") + "," } });
    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(12);
    fireEvent.change(tags, { target: { value: "One more" } });
    fireEvent.keyDown(tags, { key: "Enter" });
    expect(screen.getAllByRole("button", { name: /^Remove/ })).toHaveLength(12);
    expect(screen.getByText("You can add up to 12 skills.")).toBeInTheDocument();
  });

  it("rejects skills outside 2 to 40 characters", () => {
    expect(addSkills([], "A").error).toMatch(/2 to 40/);
    expect(addSkills([], "x".repeat(41)).error).toMatch(/2 to 40/);
    expect(addSkills([], "  Power   BI ").skills).toEqual(["Power BI"]);
  });
});
