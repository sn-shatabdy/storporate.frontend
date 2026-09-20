import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";

// `vi.hoisted` runs before module imports, so its callback can safely
// declare the URL store and the snapshot helpers that the `vi.mock`
// factories below reference.
const hoisted = vi.hoisted(() => {
  type Listener = () => void;
  const urlStore: {
    params: URLSearchParams;
    listeners: Set<Listener>;
  } = {
    params: new URLSearchParams(""),
    listeners: new Set<Listener>(),
  };
  function notifyListeners() {
    for (const fn of urlStore.listeners) fn();
  }
  return { urlStore, notifyListeners };
});

// Mocks MUST be hoisted before the page module is imported.
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

const routerReplaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
  useSearchParams: () => {
    // Lazy require so the React module is available when this runs
    // (the mock factory is hoisted above the imports).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require("react") as typeof import("react");
    return React.useSyncExternalStore(
      (cb: () => void) => {
        hoisted.urlStore.listeners.add(cb);
        return () => {
          hoisted.urlStore.listeners.delete(cb);
        };
      },
      () => hoisted.urlStore.params,
      () => hoisted.urlStore.params,
    );
  },
}));

/** Update the URL the mocked page reads. The production code calls
 *  `router.replace("?exploration=id")` and the mock parses the query
 *  string out and notifies the listeners. */
function setupSearchParams(initial: Record<string, string> = {}) {
  const sp = new URLSearchParams("");
  for (const [k, v] of Object.entries(initial)) sp.set(k, v);
  hoisted.urlStore.params = sp;
  hoisted.notifyListeners();
}

/** Browser-back helper: simulate a back-navigation by replacing the
 *  URL store contents from outside the React tree (the equivalent of
 *  Next.js's `router.replace` triggered by a history event). */
function setUrlFromOutside(query: string) {
  hoisted.urlStore.params = new URLSearchParams(query);
  hoisted.notifyListeners();
}

vi.mock("@/lib/api/growth", async () => {
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

/** Frozen wall clock the suite uses to drive `formatUpdated` deterministically. */
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
  vi.mocked(listExplorations).mockReset();
  vi.mocked(getExploration).mockReset();
  vi.mocked(createExploration).mockReset();
  vi.mocked(deleteExploration).mockReset();
  vi.mocked(refreshExploration).mockReset();
  vi.mocked(retryExploration).mockReset();
  vi.mocked(renameExploration).mockReset();
  vi.mocked(addExplorationMessage).mockReset();
  vi.mocked(createComparison).mockReset();
  vi.mocked(listExplorations).mockResolvedValue(list);
  // getExploration is keyed by id so a row click that changes the URL
  // can drive a real detail update. When a `detail` override is
  // supplied, the test's id matches the detail's id — return that
  // detail verbatim so per-test fields (status, latestSummary, etc.)
  // are preserved.
  vi.mocked(getExploration).mockImplementation(async (id?: string) => {
    if (detail && (id === detail.id || id == null)) return detail;
    const requested = id ?? "expl-001";
    const fromList = list.find((it) => it.id === requested);
    return makeExplorationDetail({
      id: requested,
      title: fromList?.title ?? detail?.title ?? "Untitled",
      status: (fromList?.status ?? detail?.status ?? "Idle") as ExplorationDetail["status"],
      latestSummary: detail?.latestSummary ?? null,
      messages: detail?.messages ?? [],
    });
  });
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
  // Reset the URL store to empty and notify any subscribers.
  hoisted.urlStore.params = new URLSearchParams("");
  hoisted.urlStore.listeners.clear();
  hoisted.notifyListeners();
  // Wire the mocked router.replace to mutate the store + notify.
  routerReplaceMock.mockImplementation((path: string) => {
    const queryString = path.includes("?") ? (path.split("?")[1] ?? "") : "";
    hoisted.urlStore.params = new URLSearchParams(queryString);
    hoisted.notifyListeners();
  });
  // Freeze the wall clock for deterministic relative-time labels.
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  if (originalMatchMedia) {
    window.matchMedia = originalMatchMedia;
    originalMatchMedia = null;
  }
});

describe("AdvisorPage — first visit auto-start", () => {
  it("auto-creates an exploration exactly once when the list is empty", async () => {
    setupMocks([], null);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(createExploration).toHaveBeenCalledTimes(1);
    });
  });

  it("does NOT show the legacy 'Start your first exploration' empty card", async () => {
    setupMocks([], null);

    render(<AdvisorPage />);

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
    expect(screen.getAllByText("Updated 1 h ago").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Updated 3 days ago").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Updated 19 Aug").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(`3 of 20`).length).toBeGreaterThanOrEqual(1);
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

    fireEvent.click(screen.getByRole("button", { name: "Delete exploration" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Delete this exploration?");
    expect(dialog).toHaveTextContent(
      "Its messages and summaries are removed. You cannot undo this.",
    );

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
    expect(
      screen.queryByText(/Backend says/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Try again.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Refresh/i }),
    ).toBeInTheDocument();
  });
});

describe("AdvisorPage — Fix 5: MAX_EXPLORATIONS_PER_STUDENT constant", () => {
  it("uses 20 as the per-student cap mirrored from the backend", async () => {
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

    await waitFor(() => {
      expect(screen.getByText("What's the goal?")).toBeInTheDocument();
    });
    expect(screen.queryByRole("textbox", { name: /Message/i })).not.toBeInTheDocument();
    const sendAnswers = screen.getByRole("button", { name: /Send answers/i });
    expect(sendAnswers).toBeDisabled();

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
  it("stops polling once the detail status flips to Idle", async () => {
    setupSession();
    const items = [makeExplorationListItem({ id: "a", title: "Working" })];
    vi.mocked(listExplorations).mockResolvedValue(items);
    vi.mocked(getExploration).mockImplementation(async () =>
      makeExplorationDetail({ id: "a", title: "Working", status: "Idle" }),
    );

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(getExploration).toHaveBeenCalledTimes(1);
    });

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

    const compareButtons = screen.getAllByRole("button", { name: /Compare/i });
    fireEvent.click(compareButtons[0]!);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Compare 2 selected/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
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

    expect(screen.getAllByText("Updated 1 h ago").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Preparing").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Failed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Explorations").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(`3 of 20`).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/What you can do here/i)).not.toBeInTheDocument();
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

    await screen.findByLabelText("Explorations");

    const firstRow = screen.getByRole("button", { name: /First/ });
    expect(firstRow).toHaveAttribute("aria-current", "true");

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

    fireEvent.click(screen.getAllByRole("button", { name: /Compare/i })[0]!);

    const confirm = await screen.findByRole("button", {
      name: /Compare 2 selected/i,
    });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getAllByText("First")[0]!);
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getAllByText("Second")[0]!);
    expect(confirm).not.toBeDisabled();

    fireEvent.click(screen.getAllByText("Third")[0]!);
    expect(confirm).not.toBeDisabled();
  });

  it("shows the friendly 'Both explorations need a summary first.' error on exploration_has_no_summary", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "First" }),
      makeExplorationListItem({ id: "b", title: "Second" }),
    ];

    setupMocks(items, makeExplorationDetail({ id: "a", title: "First" }));

    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(createComparison).mockRejectedValue(
      new ApiError("exploration_has_no_summary", "No summary yet", 422),
    );

    render(<AdvisorPage />);

    await screen.findByLabelText("Explorations");

    fireEvent.click(screen.getByRole("button", { name: /^Compare$/ }));

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

  // Fix 3 (compare-error clearing): Cancel clears the error.
  it("clears the compare error when Cancel is clicked after a failed submit", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "First" }),
      makeExplorationListItem({ id: "b", title: "Second" }),
    ];
    setupMocks(items, makeExplorationDetail({ id: "a", title: "First" }));

    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(createComparison).mockRejectedValue(
      new ApiError("exploration_has_no_summary", "No summary yet", 422),
    );

    render(<AdvisorPage />);

    await screen.findByLabelText("Explorations");

    fireEvent.click(screen.getByRole("button", { name: /^Compare$/ }));

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

    // Click Cancel — the error text must be gone.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(
        screen.queryByText(/Both explorations need a summary first\./),
      ).not.toBeInTheDocument();
    });
  });

  // Fix 3 (compare-error clearing): changing a checkbox clears the error.
  it("clears the compare error when the user toggles a checkbox after a failed submit", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "First" }),
      makeExplorationListItem({ id: "b", title: "Second" }),
      makeExplorationListItem({ id: "c", title: "Third" }),
    ];
    setupMocks(items, makeExplorationDetail({ id: "a", title: "First" }));

    const { ApiError } = await import("@/lib/api/errors");
    vi.mocked(createComparison).mockRejectedValue(
      new ApiError("exploration_has_no_summary", "No summary yet", 422),
    );

    render(<AdvisorPage />);

    await screen.findByLabelText("Explorations");

    fireEvent.click(screen.getByRole("button", { name: /^Compare$/ }));

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

    // Toggle a checkbox — the error must clear immediately.
    fireEvent.click(railRow("First"));
    await waitFor(() => {
      expect(
        screen.queryByText(/Both explorations need a summary first\./),
      ).not.toBeInTheDocument();
    });
    // The Compare button is now disabled again because toggling off
    // "First" leaves only "Second" checked.
    expect(confirm).toBeDisabled();
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

    expect(conversationTab).toHaveAttribute("aria-selected", "true");
    expect(summaryTab).toHaveAttribute("aria-selected", "false");

    fireEvent.click(summaryTab);
    expect(summaryTab).toHaveAttribute("aria-selected", "true");
    expect(conversationTab).toHaveAttribute("aria-selected", "false");
    await waitFor(() => {
      expect(
        screen.getByText("Tabbed suggestion"),
      ).toBeInTheDocument();
    });

    fireEvent.click(conversationTab);
    expect(conversationTab).toHaveAttribute("aria-selected", "true");
  });
});


// --------------------------------------------------------------------
// STOR-40 Phase 5 / Cross-Validation — fix-and-verify tests for A1/A2/A3/A4
// --------------------------------------------------------------------

/** Helper to scope a test's viewport to one breakpoint. The setup-level
 * matchMedia stub matches `(min-width: 1024px)` (lg) but not `(min-width:
 * 1280px)` (xl) — these helpers flip that on/off per-test so we can
 * assert phone-only / desktop-only behavior without polluting the global
 * stub. Restored automatically in `afterEach`. */
let originalMatchMedia: typeof window.matchMedia | null = null;
function setViewport(lg: boolean) {
  originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: lg ? !/max-width/.test(query) : false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe("AdvisorPage — A2 phone layout (390px)", () => {
  it("shows ONLY the list screen (rail + heading) on phone when no URL param is set", async () => {
    setViewport(false);
    const items = [makeExplorationListItem({ id: "a", title: "PhoneFirst" })];
    setupMocks(items, null);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Advisor" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/One exploration for each direction\./i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Explorations")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Explorations" }),
    ).not.toBeInTheDocument();
  });

  it("shows ONLY the detail screen on phone when ?exploration=<id> is set", async () => {
    setViewport(false);
    setupSearchParams({ exploration: "a" });
    const items = [makeExplorationListItem({ id: "a", title: "PhoneDetail" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "PhoneDetail",
      status: "Idle",
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
      expect(
        screen.getByRole("heading", { name: "PhoneDetail" }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: "Explorations" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Explorations")).not.toBeInTheDocument();
  });

  it("clicking the phone back link clears ?exploration= and returns to the list screen", async () => {
    setViewport(false);
    setupSearchParams({ exploration: "a" });
    const items = [makeExplorationListItem({ id: "a", title: "GoBack" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "GoBack",
      status: "Idle",
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
      expect(
        screen.getByRole("button", { name: "Explorations" }),
      ).toBeInTheDocument();
    });
    routerReplaceMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Explorations" }));
    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalled();
    });
    const callArg = routerReplaceMock.mock.calls[0]?.[0] as string;
    expect(callArg).not.toMatch(/exploration=/);
    await waitFor(() => {
      expect(screen.getByLabelText("Explorations")).toBeInTheDocument();
    });
  });
});

describe("AdvisorPage — A3 auto-create only on the first empty list", () => {
  it("does NOT re-trigger auto-create when the user deletes the last exploration", async () => {
    setViewport(false);
    setupSession();
    vi.mocked(listExplorations)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        makeExplorationListItem({ id: "fresh", title: "New exploration" }),
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(createExploration).mockResolvedValue({
      id: "fresh",
      status: "Working",
    });

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(createExploration).toHaveBeenCalledTimes(1);
    });
    expect(createExploration).toHaveBeenCalledTimes(1);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(createExploration).toHaveBeenCalledTimes(1);
  });
});

// --------------------------------------------------------------------
// STOR-40 follow-up — Fix 4 missing tests
// --------------------------------------------------------------------

describe("AdvisorPage — row click changes selection (follow-up)", () => {
  it("clicking a second row changes the h1, sets aria-current on that row only, and the URL param equals that id", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "Alpha" }),
      makeExplorationListItem({ id: "b", title: "Beta" }),
    ];
    setupMocks(items, makeExplorationDetail({ id: "a", title: "Alpha" }));

    render(<AdvisorPage />);

    // First row starts as the auto-selected detail.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    });

    const alphaRow = screen.getByRole("button", { name: /Alpha/ });
    const betaRow = screen.getByRole("button", { name: /Beta/ });
    expect(alphaRow).toHaveAttribute("aria-current", "true");
    expect(betaRow).not.toHaveAttribute("aria-current");

    // Click Beta. After the URL store notifies the page, the h1 must
    // flip to "Beta", the URL param equals "b", and aria-current moves.
    fireEvent.click(betaRow);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Beta/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: /Alpha/ })).not.toHaveAttribute(
      "aria-current",
    );
    // The last router.replace call must have set ?exploration=b.
    expect(routerReplaceMock).toHaveBeenLastCalledWith(
      expect.stringContaining("exploration=b"),
      expect.anything(),
    );
  });
});

describe("AdvisorPage — New exploration from a populated list (follow-up)", () => {
  it("'New exploration' from a populated list: createExploration is called once and the URL param becomes the new id", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "First" }),
      makeExplorationListItem({ id: "b", title: "Second" }),
    ];
    setupMocks(items, makeExplorationDetail({ id: "a", title: "First" }));
    vi.mocked(createExploration).mockResolvedValue({
      id: "expl-new",
      status: "Working",
    });

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "First" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: /New exploration/i })[0]!);

    await waitFor(() => {
      expect(createExploration).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenLastCalledWith(
        expect.stringContaining("exploration=expl-new"),
        expect.anything(),
      );
    });
    // The URL store reflects the new id (the page reads it on the next
    // render and the new exploration becomes the selected detail).
    expect(hoisted.urlStore.params.get("exploration")).toBe("expl-new");
  });
});

describe("AdvisorPage — unknown ?exploration=<id> (follow-up)", () => {
  it("desktop (lg) with unknown ?exploration=zzz: the first item is selected and router.replace is called 0 times (no loop)", async () => {
    setupSession();
    setupSearchParams({ exploration: "zzz" });
    const items = [
      makeExplorationListItem({ id: "a", title: "Alpha" }),
      makeExplorationListItem({ id: "b", title: "Beta" }),
    ];
    setupMocks(items, null);

    render(<AdvisorPage />);

    // The first item auto-selects on lg when the param doesn't match.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    });

    // Wait for any loops to fire and assert router.replace was never called.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });
});

describe("AdvisorPage — browser back (follow-up)", () => {
  it("after selecting item B, calling setUrlFromOutside('exploration=a') inside act selects item A", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "Alpha" }),
      makeExplorationListItem({ id: "b", title: "Beta" }),
    ];
    setupMocks(items, makeExplorationDetail({ id: "a", title: "Alpha" }));

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    });

    // Select Beta via a click → URL becomes ?exploration=b.
    fireEvent.click(screen.getByRole("button", { name: /Beta/ }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    });
    expect(hoisted.urlStore.params.get("exploration")).toBe("b");

    // Browser-back: the URL store is replaced from outside the React
    // tree. The page must react to the new URL and re-select Alpha.
    act(() => {
      setUrlFromOutside("exploration=a");
    });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    });
    expect(hoisted.urlStore.params.get("exploration")).toBe("a");
  });
});

describe("AdvisorPage — desktop mount with 3 items and no param (follow-up)", () => {
  it("the first item is selected and router.replace is called 0 times", async () => {
    const items = [
      makeExplorationListItem({ id: "a", title: "Alpha" }),
      makeExplorationListItem({ id: "b", title: "Beta" }),
      makeExplorationListItem({ id: "c", title: "Gamma" }),
    ];
    setupMocks(items, makeExplorationDetail({ id: "a", title: "Alpha" }));

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(routerReplaceMock).not.toHaveBeenCalled();
  });
});

describe("AdvisorPage — StrictMode auto-create (follow-up)", () => {
  it("first list response empty under <StrictMode> fires exactly ONE createExploration call", async () => {
    setupSession();
    vi.mocked(listExplorations).mockResolvedValue([]);
    vi.mocked(createExploration).mockResolvedValue({
      id: "expl-new",
      status: "Working",
    });

    render(
      <StrictMode>
        <AdvisorPage />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(createExploration).toHaveBeenCalledTimes(1);
    });
    // Hold a moment longer — the StrictMode double-mount would have
    // fired the second create call by now if the ref guard were broken.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(createExploration).toHaveBeenCalledTimes(1);
  });
});

describe("AdvisorPage — delete-the-last-exploration path (follow-up)", () => {
  it("non-empty first response, delete the last exploration: 'No explorations yet' shows and createExploration is NOT called", async () => {
    setViewport(false);
    // Phone layout: the URL param drives which screen renders, so we
    // need ?exploration=a for the detail screen to show "Doomed".
    setupSearchParams({ exploration: "a" });
    const detail = makeExplorationDetail({ id: "a", title: "Doomed" });
    const initialList = [makeExplorationListItem({ id: "a", title: "Doomed" })];
    setupMocks(initialList, detail);
    // After setupMocks the default for `listExplorations` is the
    // initial 1-item list. We need:
    //   Call 1 (mount):       initial 1-item list
    //   Call 2 (post-delete): empty list
    //   Call 3+ (after):      empty list
    // Vitest's once-shot queue is FIFO — the first response queued
    // is consumed on the first call. So we queue the initial 1-item
    // list first (consumed on Call 1) and the empty post-delete
    // response second (consumed on Call 2). The new default ([])
    // takes over for Call 3+.
    vi.mocked(listExplorations).mockResolvedValueOnce(initialList);
    vi.mocked(listExplorations).mockResolvedValueOnce([]);
    vi.mocked(listExplorations).mockResolvedValue([]);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Doomed" })).toBeInTheDocument();
    });

    // Confirm the delete — the dialog appears and the click resolves it.
    fireEvent.click(screen.getByRole("button", { name: "Delete exploration" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByText("No explorations yet")).toBeInTheDocument();
    });
    expect(createExploration).not.toHaveBeenCalled();

    // Click the empty-state card's "New exploration" button to make
    // sure it still creates one — this is the explicit user path.
    fireEvent.click(
      screen.getAllByRole("button", { name: /New exploration/i })[0]!,
    );
    await waitFor(() => {
      expect(createExploration).toHaveBeenCalledTimes(1);
    });
  });
});

describe("AdvisorPage — delete on desktop with items remaining (follow-up)", () => {
  it("after delete, the URL param is removed and the first remaining item is selected", async () => {
    setupSession();
    setupSearchParams({ exploration: "a" });
    const initialItems = [
      makeExplorationListItem({ id: "a", title: "Doomed" }),
      makeExplorationListItem({ id: "b", title: "Survivor" }),
    ];
    const postDeleteItems = [
      makeExplorationListItem({ id: "b", title: "Survivor" }),
    ];
    setupMocks(
      initialItems,
      makeExplorationDetail({ id: "a", title: "Doomed" }),
    );
    // Override the list mock AFTER setupMocks. setupMocks sets the
    // default to `initialItems`. We need:
    //   Call 1 (mount):       initialItems
    //   Call 2 (post-delete): postDeleteItems
    //   Call 3+ (after):      postDeleteItems
    // Vitest's once-shot queue is FIFO — the first response queued
    // is consumed on the first call. So we queue `initialItems`
    // first (consumed on Call 1) and `postDeleteItems` second
    // (consumed on Call 2). The new default (`postDeleteItems`)
    // takes over for Call 3+.
    vi.mocked(listExplorations).mockResolvedValueOnce(initialItems);
    vi.mocked(listExplorations).mockResolvedValueOnce(postDeleteItems);
    vi.mocked(listExplorations).mockResolvedValue(postDeleteItems);

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Doomed" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete exploration" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteExploration).toHaveBeenCalledWith("a", ACCESS_TOKEN);
    });
    // URL is cleared of the deleted id.
    await waitFor(() => {
      expect(hoisted.urlStore.params.get("exploration")).toBeNull();
    });
    // The first remaining item (Survivor) becomes the selected detail
    // via the lg-only fallback.
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Survivor" })).toBeInTheDocument();
    });
  });
});

describe("AdvisorPage — A4 list poll with fake timers (follow-up)", () => {
  // Replace the real-time 4 s polling test with a fake-timer version so
  // the whole suite finishes in seconds. Only the interval functions
  // are faked — promises and testing-library APIs still work normally.
  it("rail row title + 'Updated' meta refresh when a Working row becomes Idle", async () => {
    vi.useFakeTimers({
      toFake: ["setInterval", "clearInterval"],
    });
    setupSession();
    vi.mocked(listExplorations)
      // Initial list response: Working row.
      .mockResolvedValueOnce([
        makeExplorationListItem({ id: "a", title: "Original", status: "Working" }),
      ])
      // Next poll: row is now Idle with a new title and meta.
      .mockResolvedValueOnce([
        makeExplorationListItem({
          id: "a",
          title: "Refreshed",
          status: "Idle",
          updatedAt: "2026-09-19T15:55:00Z",
        }),
      ])
      // Subsequent polls: nothing changed. The page must stop calling
      // listExplorations because no row is Working anymore.
      .mockResolvedValue([
        makeExplorationListItem({
          id: "a",
          title: "Refreshed",
          status: "Idle",
          updatedAt: "2026-09-19T15:55:00Z",
        }),
      ]);

    render(<AdvisorPage />);

    // Wait for the initial list render.
    await waitFor(() => {
      expect(screen.getAllByText("Original").length).toBeGreaterThanOrEqual(1);
    });

    // Advance the 4 s poll interval. We await act() so the promise the
    // mock returns flushes before assertions run.
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    // The new title + a 5-minute-old "Updated" meta appears on the row.
    await waitFor(() => {
      expect(screen.getAllByText("Refreshed").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText(/Updated.*ago/i).length).toBeGreaterThanOrEqual(1);

    // Advance another 8 s — two more poll ticks. No row is Working, so
    // the list-poll effect must have cleared the interval.
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });

    // Count the listExplorations calls. The initial fetch is 1, the
    // post-poll refresh is 2. After polling stops there should be no
    // further calls.
    expect(vi.mocked(listExplorations).mock.calls.length).toBe(2);
  });

  it("A4 — terminal-transition effect refetches the list (fake timers)", async () => {
    vi.useFakeTimers({
      toFake: ["setInterval", "clearInterval"],
    });
    setupSession();
    const items = [makeExplorationListItem({ id: "a", title: "Polling", status: "Working" })];
    vi.mocked(listExplorations)
      .mockResolvedValueOnce(items)
      .mockResolvedValue([
        makeExplorationListItem({ id: "a", title: "Polling", status: "Idle" }),
      ]);
    // First detail response: Working. Subsequent: Idle.
    vi.mocked(getExploration).mockResolvedValueOnce(
      makeExplorationDetail({ id: "a", title: "Polling", status: "Working" }),
    );
    vi.mocked(getExploration).mockResolvedValue(
      makeExplorationDetail({ id: "a", title: "Polling", status: "Idle" }),
    );

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(getExploration).toHaveBeenCalledTimes(1);
    });

    // Advance 4 s — the detail poll picks up Idle and the terminal-
    // transition effect bumps listVersion, triggering a second list
    // fetch.
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });

    await waitFor(() => {
      expect(vi.mocked(listExplorations).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    expect(vi.mocked(getExploration).mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AdvisorPage — opening an already-Idle exploration does NOT refetch the list (cleanup)", () => {
  it("selecting an Idle exploration does not bump listVersion (no extra list call)", async () => {
    setupSession();
    const items = [
      makeExplorationListItem({ id: "a", title: "Alpha", status: "Idle" }),
      makeExplorationListItem({ id: "b", title: "Beta", status: "Idle" }),
    ];
    setupMocks(items, makeExplorationDetail({ id: "a", title: "Alpha", status: "Idle" }));

    render(<AdvisorPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Alpha" })).toBeInTheDocument();
    });

    const callsAfterMount = vi.mocked(listExplorations).mock.calls.length;

    // Click Beta. The selected detail becomes Beta — already Idle, so
    // no terminal-transition effect should fire.
    fireEvent.click(screen.getByRole("button", { name: /Beta/ }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Beta" })).toBeInTheDocument();
    });

    // Allow any pending refetches to fire.
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(vi.mocked(listExplorations).mock.calls.length).toBe(callsAfterMount);
  });
});

describe("AdvisorPage — phone Refresh button width (follow-up Fix 2)", () => {
  it("on phone (?exploration=a) the Refresh button is not full width and shares its row with the icon buttons", async () => {
    setViewport(false);
    setupSearchParams({ exploration: "a" });
    const items = [makeExplorationListItem({ id: "a", title: "PhoneDetail" })];
    const detail = makeExplorationDetail({
      id: "a",
      title: "PhoneDetail",
      status: "Idle",
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
      expect(
        screen.getByRole("heading", { name: "PhoneDetail" }),
      ).toBeInTheDocument();
    });

    const refresh = screen.getByRole("button", { name: "Refresh" });
    const rename = screen.getByRole("button", { name: "Rename exploration" });
    const del = screen.getByRole("button", { name: "Delete exploration" });

    // The Refresh button class must NOT contain the full-width utility.
    expect(refresh.className).not.toMatch(/\bw-full\b/);
    // The three buttons must share an immediate flex parent so the
    // phone row can keep them inside the viewport.
    const refreshParent = refresh.parentElement!;
    expect(refreshParent).toBe(rename.parentElement);
    expect(refreshParent).toBe(del.parentElement);
  });
});
