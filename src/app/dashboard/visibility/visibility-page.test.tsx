import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Mocks MUST be hoisted before the page module is imported.
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/api/discovery", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/discovery")>(
      "@/lib/api/discovery",
    );
  return {
    ...actual,
    getSearchableProfile: vi.fn(),
    updateSearchableProfile: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import {
  ApiError,
} from "@/lib/api/errors";
import {
  getSearchableProfile,
  updateSearchableProfile,
  type SearchableProfile,
} from "@/lib/api/discovery";

import VisibilityPage from "./page";

const ACCESS_TOKEN = "test-token";

const SAVED_PROFILE_OFF: SearchableProfile = {
  isSearchable: false,
  displayName: "",
  headline: null,
  university: null,
  fieldOfStudy: null,
  studyYear: null,
  showHeadline: true,
  showUniversity: true,
  showFieldOfStudy: true,
  showStudyYear: true,
  optedInAt: null,
  updatedAt: "2026-09-21T00:00:00Z",
  visibleItemCount: 0,
};

function setupSession() {
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN } as never,
    status: "authenticated",
  } as never);
}

beforeEach(() => {
  // Reset ALL mock state (call history + once-queues). `vi.clearAllMocks`
  // only clears history and would leak `mockResolvedValueOnce` /
  // `mockRejectedValueOnce` queues from earlier tests into this one —
  // e.g. the previous test's resolved PUT mock would still fire here.
  vi.resetAllMocks();
  setupSession();
});

afterEach(() => {
  cleanup();
});

/** Whole-page check that the asserted copy contains none of the banned
 *  words ("evidence", "proof") and none of the typography chars we never
 *  want in new copy (em dash, en dash). */
async function expectCopyConstraints() {
  const text = document.body.textContent ?? "";
  expect(text.toLowerCase()).not.toContain("evidence");
  expect(text.toLowerCase()).not.toContain("proof");
  expect(text).not.toContain("—");
  expect(text).not.toContain("–");
}

describe("VisibilityPage — loading + error states", () => {
  it("renders the loading state then the off state with the master switch off and the shared-info card", async () => {
    let resolveProfile!: (p: SearchableProfile) => void;
    vi.mocked(getSearchableProfile).mockImplementation(
      () =>
        new Promise<SearchableProfile>((resolve) => {
          resolveProfile = resolve;
        }),
    );

    render(<VisibilityPage />);

    // First the loading gate shows.
    expect(
      screen.getByText(/Loading your visibility settings…/),
    ).toBeInTheDocument();

    // Then the ready off state renders.
    await act(async () => {
      resolveProfile(SAVED_PROFILE_OFF);
    });

    const masterSwitch = screen.getByRole("switch", {
      name: /Let employers find me/i,
    });
    expect(masterSwitch).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByText(/Off\. Employers cannot see you or your portfolio\./),
    ).toBeInTheDocument();
    // SharedInfoCard visible, ProfileDetailsForm not.
    expect(screen.getByText(/What employers would see/i)).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Display name"),
    ).not.toBeInTheDocument();
    expect(updateSearchableProfile).not.toHaveBeenCalled();
  });

  it("renders the load-error state with a Try again button that refetches", async () => {
    vi.mocked(getSearchableProfile)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(SAVED_PROFILE_OFF);

    render(<VisibilityPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Could not load your visibility settings/i),
      ).toBeInTheDocument();
    });
    expect(getSearchableProfile).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => {
      expect(getSearchableProfile).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(
        screen.getByRole("switch", { name: /Let employers find me/i }),
      ).toBeInTheDocument();
    });
  });
});

describe("VisibilityPage — on state and Save", () => {
  it("toggling the master switch on reveals the details form and the preview; the status line updates immediately", async () => {
    // Start OFF (matches the spec "toggling on reveals the form").
    const saved: SearchableProfile = {
      ...SAVED_PROFILE_OFF,
      isSearchable: false,
      visibleItemCount: 2,
    };
    vi.mocked(getSearchableProfile).mockResolvedValueOnce(saved);

    render(<VisibilityPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("switch", { name: /Let employers find me/i }),
      ).toHaveAttribute("aria-checked", "false");
    });
    expect(
      screen.queryByLabelText("Display name"),
    ).not.toBeInTheDocument();

    // Flip on.
    const masterSwitch = screen.getByRole("switch", {
      name: /Let employers find me/i,
    });
    fireEvent.click(masterSwitch);
    await waitFor(() => {
      expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    });
    // Status line now reflects draft switch = true.
    expect(
      screen.getByText(/On\. 2 portfolio items are visible in employer searches\./),
    ).toBeInTheDocument();
    // Preview card is present.
    expect(
      screen.getByText(/How employers see you/i),
    ).toBeInTheDocument();
  });

  it("Save with an empty display name shows the inline error and does NOT call PUT", async () => {
    const saved: SearchableProfile = {
      ...SAVED_PROFILE_OFF,
      isSearchable: true,
      displayName: "Nadia",
    };
    vi.mocked(getSearchableProfile).mockResolvedValueOnce(saved);
    vi.mocked(updateSearchableProfile).mockResolvedValueOnce(saved);

    render(<VisibilityPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    });

    // Force an empty display name and click Save.
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    expect(
      screen.getByText("Enter a display name."),
    ).toBeInTheDocument();
    expect(updateSearchableProfile).not.toHaveBeenCalled();
  });

  it("with name and university, the student flips Show university off and saves; PUT fires once with the expected body and no studyYear key", async () => {
    const saved: SearchableProfile = {
      ...SAVED_PROFILE_OFF,
      isSearchable: true,
      displayName: "Nadia Rahman",
      university: "BUET",
      showUniversity: true,
      visibleItemCount: 2,
    };
    const refetched: SearchableProfile = {
      ...saved,
      showUniversity: false,
      updatedAt: "2026-09-21T01:00:00Z",
    };
    vi.mocked(getSearchableProfile).mockResolvedValueOnce(saved);
    vi.mocked(updateSearchableProfile).mockResolvedValueOnce(refetched);

    render(<VisibilityPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    });

    // Flip Show university off (the spec test scenario).
    fireEvent.click(
      screen.getByRole("switch", { name: /Show university/i }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(updateSearchableProfile).toHaveBeenCalledTimes(1);
    });
    const call = vi.mocked(updateSearchableProfile).mock.calls[0];
    expect(call[0]).toBe(ACCESS_TOKEN);
    expect(call[1]).toEqual({
      isSearchable: true,
      displayName: "Nadia Rahman",
      headline: "",
      university: "BUET",
      fieldOfStudy: "",
      showHeadline: true,
      showUniversity: false,
      showFieldOfStudy: true,
      showStudyYear: true,
    });
    expect("studyYear" in (call[1] as Record<string, unknown>)).toBe(false);

    await waitFor(() => {
      expect(screen.getByText("All changes saved.")).toBeInTheDocument();
    });
  });

  it("a 400 display_name_too_long shows the inline error and keeps the typed values", async () => {
    const saved: SearchableProfile = {
      ...SAVED_PROFILE_OFF,
      isSearchable: true,
      displayName: "x".repeat(80),
    };
    vi.mocked(getSearchableProfile).mockResolvedValueOnce(saved);
    vi.mocked(updateSearchableProfile).mockRejectedValueOnce(
      new ApiError("display_name_too_long", "Use 80 characters or fewer.", 400),
    );

    render(<VisibilityPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "x".repeat(81) },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(screen.getByText("Use 80 characters or fewer.")).toBeInTheDocument();
    });
    // Form-level alert absent — error is scoped to the field.
    expect(
      screen.queryByText("Could not save your changes. Try again."),
    ).not.toBeInTheDocument();
    // Typed value preserved.
    expect((screen.getByLabelText("Display name") as HTMLInputElement).value).toBe("x".repeat(81));
  });

  it("an unknown backend error shows the form-level alert", async () => {
    const saved: SearchableProfile = {
      ...SAVED_PROFILE_OFF,
      isSearchable: true,
      displayName: "Nadia",
    };
    vi.mocked(getSearchableProfile).mockResolvedValueOnce(saved);
    vi.mocked(updateSearchableProfile).mockRejectedValueOnce(
      new ApiError("permission_denied", "nope", 403),
    );

    render(<VisibilityPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    });

    // Flip the "Show university" switch to make the form dirty. Saved
    // showUniversity is true; toggling it to false diverges → dirty=true
    // → Save is enabled. (We deliberately avoid the display-name input
    // here so this test does not share state with the ones above that
    // already exercise it.)
    fireEvent.click(
      screen.getByRole("switch", { name: /Show university/i }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    // Wait for both: PUT fires once AND the catch block sets formError,
    // which the SaveRow renders as `role="alert"` with the expected
    // message.
    await waitFor(() => {
      expect(updateSearchableProfile).toHaveBeenCalledTimes(1);
    });
    await waitFor(
      () => {
        const alerts = screen.queryAllByRole("alert");
        const found = alerts.some(
          (el) =>
            el.textContent ===
            "Could not save your changes. Try again.",
        );
        if (!found) {
          throw new Error(
            `alert not yet present; saw ${alerts.length} alert(s): ${JSON.stringify(alerts.map((a) => a.textContent))}`,
          );
        }
      },
      { timeout: 2000 },
    );
  });

  it("turning the master switch off and saving sends isSearchable false and shows the off state", async () => {
    const saved: SearchableProfile = {
      ...SAVED_PROFILE_OFF,
      isSearchable: true,
      displayName: "Nadia",
    };
    const refetched: SearchableProfile = {
      ...saved,
      isSearchable: false,
    };
    vi.mocked(getSearchableProfile).mockResolvedValueOnce(saved);
    vi.mocked(updateSearchableProfile).mockResolvedValueOnce(refetched);

    render(<VisibilityPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("switch", { name: /Let employers find me/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Save changes/i }));

    await waitFor(() => {
      expect(updateSearchableProfile).toHaveBeenCalledTimes(1);
    });
    const call = vi.mocked(updateSearchableProfile).mock.calls[0];
    expect(call[1]).toMatchObject({ isSearchable: false });
    await waitFor(() => {
      expect(
        screen.getByText(/What employers would see/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByLabelText("Display name"),
    ).not.toBeInTheDocument();
  });
});

describe("VisibilityPage — preview filtering", () => {
  it("hides university when Show university is off and shows 'Self-reported' only when a part is shown", async () => {
    const saved: SearchableProfile = {
      ...SAVED_PROFILE_OFF,
      isSearchable: true,
      displayName: "Nadia",
      university: "BUET",
      fieldOfStudy: "CSE",
      studyYear: 3,
    };
    vi.mocked(getSearchableProfile).mockResolvedValueOnce(saved);

    render(<VisibilityPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    });

    // The preview lives inside the "How employers see you" section.
    // Scope all text lookups to that section so we don't accidentally
    // match the same string in the study-year `<option>` ("Year 3"
    // appears both as an option label and in the preview line).
    const previewHeading = screen.getByText(/How employers see you/i);
    const previewSection = previewHeading.closest("section") as HTMLElement;

    // Initially all show switches are on → preview shows BUET, CSE, Year 3 + pill.
    expect(previewSection.textContent).toContain("BUET");
    expect(previewSection.textContent).toContain("CSE");
    expect(previewSection.textContent).toContain("Year 3");
    expect(previewSection.textContent).toContain("Self-reported");

    // Toggle Show university off.
    fireEvent.click(
      screen.getByRole("switch", { name: /Show university/i }),
    );
    await waitFor(() => {
      expect(previewSection.textContent).not.toContain("BUET");
    });
    // CSE + Year 3 still shown, pill still present.
    expect(previewSection.textContent).toContain("CSE");
    expect(previewSection.textContent).toContain("Year 3");
    expect(previewSection.textContent).toContain("Self-reported");

    // Toggle field + study-year off too → pill disappears.
    fireEvent.click(
      screen.getByRole("switch", { name: /Show field of study/i }),
    );
    fireEvent.click(
      screen.getByRole("switch", { name: /Show study year/i }),
    );
    expect(previewSection.textContent).not.toContain("Self-reported");
  });
});

describe("VisibilityPage — visibleItemCount pluralization", () => {
  // Off state: the master status line always reads "Off. ...", only the
  // SharedInfoCard footer pluralizes.
  for (const [count, footerLine] of [
    [0, /No portfolio items are ready yet/],
    [1, /1 portfolio item is ready to appear once you turn this on\./],
    [3, /3 portfolio items are ready to appear once you turn this on\./],
  ] as const) {
    it(`renders the off-state SharedInfoCard footer for visibleItemCount=${count}`, async () => {
      vi.mocked(getSearchableProfile).mockResolvedValueOnce({
        ...SAVED_PROFILE_OFF,
        visibleItemCount: count,
      });

      render(<VisibilityPage />);
      await waitFor(() => {
        expect(
          screen.getByRole("switch", { name: /Let employers find me/i }),
        ).toBeInTheDocument();
      });
      expect(screen.getByText(footerLine)).toBeInTheDocument();
    });
  }

  // On state: the master status line + the preview footer both
  // pluralize.
  for (const [count, masterLine, previewLine] of [
    [0, /No portfolio items are ready yet\./, /once you have an analyzed item/],
    [1, /1 portfolio item is visible/, /1 portfolio item and its skills appear with these details\./],
    [3, /3 portfolio items are visible/, /3 portfolio items and their skills appear with these details\./],
  ] as const) {
    it(`renders the master status line and preview footer for visibleItemCount=${count} (on state)`, async () => {
      vi.mocked(getSearchableProfile).mockResolvedValueOnce({
        ...SAVED_PROFILE_OFF,
        isSearchable: true,
        displayName: "Nadia",
        visibleItemCount: count,
      });

      render(<VisibilityPage />);
      await waitFor(() => {
        expect(screen.getByLabelText("Display name")).toBeInTheDocument();
      });
      expect(screen.getByText(masterLine)).toBeInTheDocument();
      expect(screen.getByText(previewLine)).toBeInTheDocument();
    });
  }
});

describe("VisibilityPage — copy hygiene", () => {
  it("does not contain 'evidence' / 'proof' / em dash / en dash in any state", async () => {
    afterEach(() => {
      document.body.innerHTML = "";
    });

    // Off state.
    vi.mocked(getSearchableProfile).mockResolvedValueOnce(SAVED_PROFILE_OFF);
    render(<VisibilityPage />);
    await waitFor(() => {
      expect(
        screen.getByRole("switch", { name: /Let employers find me/i }),
      ).toBeInTheDocument();
    });
    await expectCopyConstraints();

    // Clear DOM between renders to keep the assertion scoped.
    document.body.innerHTML = "";

    // On state.
    vi.mocked(getSearchableProfile).mockResolvedValueOnce({
      ...SAVED_PROFILE_OFF,
      isSearchable: true,
      displayName: "Nadia Rahman",
      visibleItemCount: 2,
    });
    render(<VisibilityPage />);
    await waitFor(() => {
      expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    });
    await expectCopyConstraints();

    document.body.innerHTML = "";

    // Error state.
    vi.mocked(getSearchableProfile).mockRejectedValueOnce(
      new Error("nope"),
    );
    render(<VisibilityPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/Could not load your visibility settings/i),
      ).toBeInTheDocument();
    });
    await expectCopyConstraints();
  });
});
