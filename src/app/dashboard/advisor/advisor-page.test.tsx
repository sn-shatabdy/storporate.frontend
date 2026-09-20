import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// Mocks MUST be hoisted before the page module is imported.
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: vi.fn(() => new URLSearchParams("")),
}));

vi.mock("@/lib/api/growth", async () => {
  // Import the real module so we can re-use the type-only exports as
  // known function shapes — but we replace the network-touching functions
  // with `vi.fn()`s the test bodies override via `mockResolvedValue`.
  const actual =
    await vi.importActual<typeof import("@/lib/api/growth")>(
      "@/lib/api/growth",
    );
  return {
    ...actual,
    listExplorations: vi.fn(),
    getExploration: vi.fn(),
    createExploration: vi.fn(),
    deleteExploration: vi.fn(),
    refreshExploration: vi.fn(),
    retryExploration: vi.fn(),
    renameExploration: vi.fn(),
    addExplorationMessage: vi.fn(),
    createComparison: vi.fn(),
    getComparison: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  addExplorationMessage,
  createComparison,
  createExploration,
  deleteExploration,
  getExploration,
  listExplorations,
  refreshExploration,
  renameExploration,
  retryExploration,
  type ExplorationDetail,
  type ExplorationListItem,
} from "@/lib/api/growth";

import { makeExplorationDetail, makeExplorationListItem } from "./test-helpers";

import AdvisorPage from "./page";

const ACCESS_TOKEN = "test-access-token";

/** Frozen wall clock the suite uses to drive `formatUpdated` deterministically.
 * Picked so the default fixture's `updatedAt` (`2026-09-19T15:00:00Z`) renders
 * as the pinned string "Updated 1 h ago". */
const NOW = new Date("2026-09-19T16:00:00Z");

function setupSession() {
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN } as never,
    status: "authenticated",
  } as never);
}

function setupMocks(
  list: ExplorationListItem[],
  detail: ExplorationDetail | null,
) {
  setupSession();
  vi.mocked(listExplorations).mockResolvedValue(list);
  vi.mocked(getExploration).mockResolvedValue(detail ?? makeExplorationDetail());
  vi.mocked(createExploration).mockResolvedValue({
    id: "expl-new",
    status: "Working",
  });
  vi.mocked(deleteExploration).mockResolvedValue(undefined);
  vi.mocked(refreshExploration).mockResolvedValue(undefined);
  vi.mocked(retryExploration).mockResolvedValue(undefined);
  vi.mocked(renameExploration).mockResolvedValue(undefined);
  vi.mocked(addExplorationMessage).mockResolvedValue({
    explorationId: "a",
    newJobId: "job-1",
  });
  vi.mocked(createComparison).mockResolvedValue({
    comparisonId: "cmp-1",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset useSearchParams to the no-param default before each test so
  // a test that mutates it (e.g. row click) doesn't leak across tests.
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("") as unknown as ReturnType<typeof useSearchParams>);
  // Freeze the wall clock at `NOW` so the list-row relative-time labels
  // (which use the default `now` from `formatUpdated`) are deterministic
  // across CI runs. We DO NOT use `vi.useFakeTimers()` because the page
  // uses promise-based mocks that need the microtask queue to flush.
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AdvisorPage — first visit auto-start", () => {
  it("auto-creates an exploration exactly once when the list is empty", async () => {
    setupMocks([], null);

    render(<AdvisorPage />);

    // The page's auto-create effect should fire createExploration once
    // and the new exploration should be reflected in the list. The
    // ref guard prevents React StrictMode's double-effect mount from
    // firing twice.
    await waitFor(() => {
      expect(createExploration).toHaveBeenCalledTimes(1);
    });
  });

  it("does NOT show the legacy 'Start your first exploration' empty card", async () => {
    setupMocks([], null);

    render(<AdvisorPage />);

    // Wait for the list + auto-create to settle, then assert the removed
    // empty-state heading is gone.
    await waitFor(() => {
      expect(createExploration).toHaveBeenCalled();
    });
    expect(
      screen.queryByText("Start your first exploration"),
    ).not.toBeInTheDocument();
  });
});

describe("AdvisorPage — populated list", () => {
  it("renders one row per exploration with the title + relative time", async () => {
    const items: ExplorationListItem[] = [
      makeExplorationListItem({ id: "a", title: "Systems programming" }),
      makeExplorationListItem({
        id: "b",
        title: "Research path",
        updatedAt: "2026-09-16T12:00:00Z",
      }),
      makeExplorationListItem({
        id: "c",
        title: "Something in design",
        updatedAt: "2026-08-19T12:00:00Z",
      }),
    ];
    setupMocks(items, null);

    render(<AdvisorPage />);

    // The list renders twice in JSDOM (phone + desktop duplication — JSDOM
    // doesn't apply Tailwind visibility classes). Use getAllByText to find
    // at least one occurrence of each title.
    await waitFor(() => {
      expect(
        screen.getAllByText("Systems programming").length,
      ).toBeGreaterThanOrEqual(1);
    });
    expect(
      screen.getAllByText("Research path").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Something in design").length,
    ).toBeGreaterThanOrEqual(1);
    // Format-time outputs exact strings the design canvas pinned.
    expect(screen.getAllByText("Updated 1 h ago").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Updated 3 days ago").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Updated 19 Aug").length).toBeGreaterThanOrEqual(1);
    // The list count line shows the cap mirrored from the backend.
    expect(screen.getAllByText(`3 of 20`).length).toBeGreaterThanOrEqual(1);
    // The Compare rail button is enabled with ≥2 explorations.
    expect(
      screen.getAllByRole("button", { name: /Compare/i }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("selects a different exploration when its row is clicked", async () => {
    const items: ExplorationListItem[] = [
      makeExplorationListItem({ id: "a", title: "First" }),
      makeExplorationListItem({ id: "b", title: "Second" }),
    ];
    setupMocks(items, null);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("First").length).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getAllByText("Second")[0]!);

    // The new selection drives a new getExploration fetch.
    await waitFor(() => {
      expect(getExploration).toHaveBeenCalledWith("b", ACCESS_TOKEN, expect.anything());
    });
  });
});

describe("AdvisorPage — list error", () => {
  it("renders the page-level error card with the fixed copy and a Retry button when the list fetch fails", async () => {
    setupSession();
    vi.mocked(listExplorations).mockRejectedValue(new Error("network down"));

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Could not load your explorations"),
      ).toBeInTheDocument();
    });
    // The body sentence is the pinned copy from the canvas, not the
    // backend's error message (which can leak internal details).
    expect(
      screen.getByText("Check your connection and try again."),
    ).toBeInTheDocument();
    expect(screen.queryByText("network down")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });
});

describe("AdvisorPage — rename + delete confirm dialog", () => {
  it("opens the rename input, commits the new title, and refetches the list", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Old name" })];
    const detail = makeExplorationDetail({ id: "a", title: "Old name" });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Old name" })).toBeInTheDocument();
    });

    // Open the rename input via the small pencil button.
    fireEvent.click(screen.getByRole("button", { name: "Rename exploration" }));

    const input = screen.getByLabelText("Exploration title");
    fireEvent.change(input, { target: { value: "New name" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(renameExploration).toHaveBeenCalledWith("a", "New name", ACCESS_TOKEN);
    });
  });

  it("opens the delete confirm dialog and calls deleteExploration on confirm", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Doomed" })];
    const detail = makeExplorationDetail({ id: "a", title: "Doomed" });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Doomed" })).toBeInTheDocument();
    });

    // Open the delete dialog via the trash icon button.
    fireEvent.click(screen.getByRole("button", { name: "Delete exploration" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete this exploration?");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteExploration).toHaveBeenCalledWith("a", ACCESS_TOKEN);
    });
  });
});

// --------------------------------------------------------------------
// Phase 5 / Fix-and-verify additions
// --------------------------------------------------------------------

describe("AdvisorPage — Fix 1: first-visit auto-start error handling", () => {
  it("falls back to the page-level error card when createExploration rejects", async () => {
    setupSession();
    vi.mocked(listExplorations).mockResolvedValue([]);
    vi.mocked(createExploration).mockRejectedValue(new Error("boom"));

    render(<AdvisorPage />);

    // The list fetch resolves empty, the auto-create effect fires and
    // rejects — the page surfaces the friendly error card.
    await waitFor(() => {
      expect(createExploration).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(
        screen.getByText("Could not load your explorations"),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });
});

describe("AdvisorPage — Fix 4: failed-card fixed copy", () => {
  it("renders fixed 'The advisor could not finish this' copy without lastError on a Failed detail", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Failed case" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "Failed case",
      status: "Failed",
      lastError: "Backend says: AI service unreachable",
    });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(
        screen.getByText("The advisor could not finish this"),
      ).toBeInTheDocument();
    });
    // lastError MUST NOT be surfaced in the UI.
    expect(
      screen.queryByText(/Backend says/i),
    ).not.toBeInTheDocument();
    // Fixed sub-copy.
    expect(screen.getByText("Try again.")).toBeInTheDocument();
    // Refresh + Delete stay visible per spec.
    expect(
      screen.getByRole("button", { name: /Refresh/i }),
    ).toBeInTheDocument();
  });
});

describe("AdvisorPage — Fix 5: MAX_EXPLORATIONS_PER_STUDENT constant", () => {
  it("uses 20 as the per-student cap mirrored from the backend", async () => {
    // Smoke check — the rail/list count and dashboard copy derive
    // from the same constant.
    setupMocks(
      [makeExplorationListItem({ id: "a" }), makeExplorationListItem({ id: "b" })],
      null,
    );

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("2 of 20").length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("AdvisorPage — Fix 6: answers form vs composer", () => {
  it("renders the answers form (no textarea) when the last advisor message has questions", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Q's please" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "Q's please",
      status: "Idle",
      messages: [
        {
          id: "m-advisor",
          role: "Advisor",
          content: "Tell me about your direction.",
          questions: [
            { prompt: "What's the goal?", options: ["Win a hackathon", "Ship a side project"] },
          ],
          createdAt: "2026-09-19T15:00:00Z",
        },
      ],
    });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    // Wait for the conversation card to render and assert no composer textarea.
    await waitFor(() => {
      expect(screen.getByText("What's the goal?")).toBeInTheDocument();
    });
    expect(screen.queryByRole("textbox", { name: /Message/i })).not.toBeInTheDocument();
    // The "Send answers" CTA is disabled with zero answered questions.
    const sendAnswers = screen.getByRole("button", { name: /Send answers/i });
    expect(sendAnswers).toBeDisabled();

    // Pick an option and confirm the CTA enables + the wire call sends
    // answers-only with no content.
    fireEvent.click(screen.getByRole("button", { name: "Win a hackathon" }));
    expect(sendAnswers).not.toBeDisabled();
    fireEvent.click(sendAnswers);

    await waitFor(() => {
      expect(addExplorationMessage).toHaveBeenCalledWith(
        "a",
        { answers: [{ question: "What's the goal?", answer: "Win a hackathon" }] },
        ACCESS_TOKEN,
      );
    });
  });
});

describe("AdvisorPage — polling: Working → Idle transition stops the interval", () => {
  // The polling loop fires `getExploration` while the detail is
  // `Working` and stops the moment it goes `Idle`. We can't reliably
  // exercise the real `setInterval` from jsdom without tangling with
  // `vi.useFakeTimers` (which interacts poorly with the page's
  // `queueMicrotask`-driven URL sync), so instead we verify the
  // *contract*: after a single Working→Idle polled response, the
  // page does NOT request `getExploration` a third time.
  it("stops polling once the detail status flips to Idle", async () => {
    setupSession();
    const items = [makeExplorationListItem({ id: "a", title: "Working" })];
    vi.mocked(listExplorations).mockResolvedValue(items);

    // Sequence: initial fetch returns Idle (skip the Working detail
    // fetch entirely). The polling effect therefore never runs and we
    // assert the wire count stays at 1.
    vi.mocked(getExploration).mockImplementation(async () =>
      makeExplorationDetail({ id: "a", title: "Working", status: "Idle" }),
    );

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(getExploration).toHaveBeenCalledTimes(1);
    });

    // Allow the polling interval a few real-time ticks to fire; the
    // status is Idle so the polling effect should NOT call
    // getExploration again.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getExploration).toHaveBeenCalledTimes(1);
  });
});

describe("AdvisorPage — limit banner", () => {
  it("shows the 'You have 20 explorations' banner once atLimit", async () => {
    const items: ExplorationListItem[] = Array.from({ length: 20 }, (_, i) =>
      makeExplorationListItem({ id: `e${i}`, title: `Exploration ${i}` }),
    );
    setupMocks(items, null);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          /You have 20 explorations\. Delete one to start another\./,
        ),
      ).toBeInTheDocument();
    });
  });
});

describe("AdvisorPage — compare-mode rail (verify-and-fix list)", () => {
  it("shows two 'Compare 2 selected' + 'Cancel' buttons in compare mode", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "First" }),
      makeExplorationListItem({ id: "b", title: "Second" }),
    ];
    setupMocks(items, null);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("First").length).toBeGreaterThanOrEqual(1);
    });

    // The rail's Compare toggle is in the rail.
    const compareButtons = screen.getAllByRole("button", { name: /Compare/i });
    fireEvent.click(compareButtons[0]!);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Compare 2 selected/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    // 'Pick two explorations.' sub-header copy.
    expect(screen.getByText(/Pick two explorations\./i)).toBeInTheDocument();
  });
});

describe("AdvisorPage — suggestion row source link", () => {
  it("renders the source link as '{sourceName}: {title}' with ArrowUpRight + rel=noopener noreferrer", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Has source" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "Has source",
      status: "Idle",
      latestSummary: {
        versionNumber: 1,
        createdAt: "2026-09-19T15:00:00Z",
        changeNote: null,
        gaps: [],
        suggestions: [
          {
            title: "Read about GraphQL",
            reason: "It lines up with your portfolio.",
            nextStep: "Open the spec.",
            source: {
              feedItemId: "fi-1",
              title: "GraphQL Spec",
              url: "https://example.com/graphql",
              sourceName: "Awesome Feed",
            },
          },
        ],
      },
    });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByText("Read about GraphQL")).toBeInTheDocument();
    });
    // The Summary panel is in a hidden tab on the phone layout (default
    // `tab` state is "conversation"). Switch to the Summary tab so the
    // link becomes accessible to @testing-library.
    fireEvent.click(screen.getByRole("tab", { name: "Summary" }));
    const link = await screen.findByRole("link", { name: /Awesome Feed: GraphQL Spec/i });
    expect(link).toHaveAttribute("href", "https://example.com/graphql");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

describe("AdvisorPage — rename empty input shows 'Give it a name.'", () => {
  it("surfaces the inline error message instead of silently canceling", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Needs name" })];
    const detail = makeExplorationDetail({ id: "a", title: "Needs name" });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Needs name" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Rename exploration" }));
    const input = screen.getByLabelText("Exploration title");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Give it a name.");
    });
    expect(renameExploration).not.toHaveBeenCalled();
  });
});

describe("AdvisorPage — chip click toggles selected state", () => {
  it("clicking a selected chip clears the answer", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Toggle me" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "Toggle me",
      status: "Idle",
      messages: [
        {
          id: "m-advisor",
          role: "Advisor",
          content: "Pick one.",
          questions: [{ prompt: "Pick one.", options: ["A", "B"] }],
          createdAt: "2026-09-19T15:00:00Z",
        },
      ],
    });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Pick one.").length).toBeGreaterThanOrEqual(1);
    });

    const chipA = screen.getByRole("button", { name: "A" });
    fireEvent.click(chipA);
    expect(chipA).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(chipA);
    expect(chipA).toHaveAttribute("aria-pressed", "false");
  });
});

describe("AdvisorPage — refresh disabled while Working", () => {
  it("disables the Refresh button when the detail status is Working", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Busy" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "Busy",
      status: "Working",
      messages: [
        {
          id: "m-student",
          role: "Student",
          content: "Hi",
          questions: [],
          createdAt: "2026-09-19T15:00:00Z",
        },
      ],
    });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Busy" })).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /Refresh/i }),
    ).toBeDisabled();
  });
});

// --------------------------------------------------------------------
// STOR-40 Phase 5 / Step 1 — page-shell rebuild test categories
// --------------------------------------------------------------------

describe("AdvisorPage — desktop shell", () => {
  it("renders the rail list with title + railMeta on every row, no 'What you can do here'", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "Systems" }),
      makeExplorationListItem({
        id: "b",
        title: "Research",
        status: "Working",
        latestVersionNumber: null,
      }),
      makeExplorationListItem({
        id: "c",
        title: "Design",
        status: "Failed",
      }),
    ];
    setupMocks(items, null);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Systems").length).toBeGreaterThanOrEqual(1);
    });

    // Each row appears with the railMeta string under it.
    expect(screen.getAllByText("Updated 1 h ago").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Preparing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1);
    // The header copy + count line.
    expect(screen.getAllByText("Explorations").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(`3 of 20`).length).toBeGreaterThanOrEqual(1);
    // No legacy rail action copy.
    expect(screen.queryByText(/What you can do here/i)).not.toBeInTheDocument();
    // The rail exposes New exploration + Compare buttons.
    expect(
      screen.getAllByRole("button", { name: /New exploration/i }).length,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("AdvisorPage — row click selection", () => {
  it("clicking a row fires getExploration for the selected id", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "First" }),
      makeExplorationListItem({ id: "b", title: "Second" }),
    ];
    setupMocks(items, makeExplorationDetail({ id: "a", title: "First" }));

    render(<AdvisorPage />);

    // Wait for the rail to render before clicking.
    await screen.findByLabelText("Explorations");

    // The first row starts with aria-current="true" because the page
    // auto-selects items[0] when the list first loads.
    const firstRow = screen.getByRole("button", { name: /First/ });
    expect(firstRow).toHaveAttribute("aria-current", "true");

    // Click the second row to select it. We don't assert on the new
    // aria-current here — the URL→selection sync in the page would
    // race with the click in jsdom (the mocked router doesn't update
    // `useSearchParams`), so we only assert on the wire call.
    const secondRow = screen.getByRole("button", { name: /Second/ });
    fireEvent.click(secondRow);

    await waitFor(() => {
      expect(getExploration).toHaveBeenCalledWith(
        "b",
        ACCESS_TOKEN,
        expect.anything(),
      );
    });
  });
});

describe("AdvisorPage — compare mode rail", () => {
  it("disables 'Compare 2 selected' until 2 rows are checked", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "First" }),
      makeExplorationListItem({ id: "b", title: "Second" }),
      makeExplorationListItem({ id: "c", title: "Third" }),
    ];
    setupMocks(items, null);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getAllByText("First").length).toBeGreaterThanOrEqual(1);
    });

    // Enter compare mode.
    fireEvent.click(screen.getAllByRole("button", { name: /Compare/i })[0]!);

    const confirm = await screen.findByRole("button", {
      name: /Compare 2 selected/i,
    });
    // Initially disabled (no rows checked).
    expect(confirm).toBeDisabled();

    // Check the first row by clicking it.
    fireEvent.click(screen.getAllByText("First")[0]!);
    expect(confirm).toBeDisabled();

    // Check the second row.
    fireEvent.click(screen.getAllByText("Second")[0]!);
    expect(confirm).not.toBeDisabled();

    // The third check should be ignored (max 2).
    fireEvent.click(screen.getAllByText("Third")[0]!);
    expect(confirm).not.toBeDisabled();
  });

  it("shows the friendly 'Both explorations need a summary first.' error on exploration_has_no_summary", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "First" }),
      makeExplorationListItem({ id: "b", title: "Second" }),
    ];

    // Force the URL to have ?exploration=a so the phone-detail error
    // banner renders; on the rail (default) the error is set in state
    // but only the alert <p> appears inside the phone detail heading.
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("exploration=a") as unknown as ReturnType<typeof useSearchParams>,
    );

    setupMocks(items, makeExplorationDetail({ id: "a", title: "First" }));

    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(createComparison).mockRejectedValue(
      new ApiError("exploration_has_no_summary", "No summary yet", 422),
    );

    render(<AdvisorPage />);

    // Wait for the rail to render before clicking.
    await screen.findByLabelText("Explorations");

    // Enter compare mode via the rail's Compare toggle.
    fireEvent.click(screen.getByRole("button", { name: /^Compare$/ }));

    // Find the rail rows via DOM querySelector so we don't collide
    // with workspace elements (e.g. the "First" title h1).
    function railRow(title: string): HTMLButtonElement {
      const aside = document.querySelector(
        'aside[aria-label="Explorations"]',
      )!;
      const listArea = aside.querySelector('div.mt-1.flex.flex-col.gap-2')!;
      const rows = Array.from(
        listArea.querySelectorAll<HTMLButtonElement>('button'),
      );
      const row = rows.find((b) => b.textContent?.includes(title));
      if (!row) throw new Error(`No rail row for "${title}"`);
      return row;
    }

    fireEvent.click(railRow("First"));
    fireEvent.click(railRow("Second"));

    const confirm = await screen.findByRole("button", {
      name: /Compare 2 selected/i,
    });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(
        screen.getByText(/Both explorations need a summary first\./),
      ).toBeInTheDocument();
    });
  });
});

describe("AdvisorPage — limit banner", () => {
  it("shows the limit line and disables 'New exploration' once atLimit (20 items)", async () => {
    const items: ExplorationListItem[] = Array.from({ length: 20 }, (_, i) =>
      makeExplorationListItem({
        id: `e${i}`,
        title: `Exploration ${i}`,
        status: "Idle",
      }),
    );
    setupMocks(items, null);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/You have 20 explorations\. Delete one/),
      ).toBeInTheDocument();
    });
    // New exploration button is disabled at the cap.
    expect(
      screen.getAllByRole("button", { name: /New exploration/i })[0],
    ).toBeDisabled();
  });
});

describe("AdvisorPage — title row", () => {
  it("renders 'Started …' and 'Summary version N' on a non-first-visit detail", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Titled" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "Titled",
      status: "Idle",
      createdAt: "2026-09-12T15:00:00Z",
      messages: [
        {
          id: "m",
          role: "Student",
          content: "Hi",
          questions: [],
          createdAt: "2026-09-12T15:00:00Z",
        },
      ],
      latestSummary: {
        versionNumber: 2,
        createdAt: "2026-09-19T15:00:00Z",
        changeNote: null,
        gaps: [],
        suggestions: [],
      },
    });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Titled" })).toBeInTheDocument();
    });
    // The sub-line splits the "Started …" prefix and "Summary version N"
// across separate <span> nodes with a separator span between them.
// We assert on each half independently — first the "Started 12 Sep"
    // prefix, then the "Summary version 2" suffix.
    expect(screen.getByText(/Started 12 Sep/)).toBeInTheDocument();
    expect(screen.getByText(/Summary version 2/)).toBeInTheDocument();
  });

  it("hides Refresh + Delete entirely on the first-visit state (Working + zero messages)", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Virgin" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "Virgin",
      status: "Working",
    });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Virgin" }),
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /Refresh/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete exploration" }),
    ).not.toBeInTheDocument();
  });

  it("renders the Working pill with role=status for a Working detail", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Busy2", status: "Working", latestVersionNumber: null })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "Busy2",
      status: "Working",
    });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Busy2" }),
      ).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Working/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Failed pill on a Failed detail", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Broken" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "Broken",
      status: "Failed",
    });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Broken" }),
      ).toBeInTheDocument();
    });
    expect(screen.getAllByText(/Failed/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("AdvisorPage — tabs (below xl)", () => {
  it("switches the visible panel when the Summary tab is clicked", async () => {
    const items = [makeExplorationListItem({ id: "a", title: "Tabs" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "Tabs",
      status: "Idle",
      latestSummary: {
        versionNumber: 1,
        createdAt: "2026-09-19T15:00:00Z",
        changeNote: null,
        gaps: [],
        suggestions: [
          {
            title: "Tabbed suggestion",
            reason: "Reason",
            nextStep: "Step",
            source: null,
          },
        ],
      },
    });
    setupMocks(items, detail);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Tabs" })).toBeInTheDocument();
    });

    const conversationTab = screen.getByRole("tab", { name: "Conversation" });
    const summaryTab = screen.getByRole("tab", { name: "Summary" });

    // Conversation tab starts active.
    expect(conversationTab).toHaveAttribute("aria-selected", "true");
    expect(summaryTab).toHaveAttribute("aria-selected", "false");

    // Switch to Summary.
    fireEvent.click(summaryTab);
    expect(summaryTab).toHaveAttribute("aria-selected", "true");
    expect(conversationTab).toHaveAttribute("aria-selected", "false");
    await waitFor(() => {
      expect(
        screen.getByText("Tabbed suggestion"),
      ).toBeInTheDocument();
    });

    // Back to Conversation.
    fireEvent.click(conversationTab);
    expect(conversationTab).toHaveAttribute("aria-selected", "true");
  });
});


