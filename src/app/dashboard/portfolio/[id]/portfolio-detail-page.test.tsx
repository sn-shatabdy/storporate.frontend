import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Mocks MUST be hoisted before the page module is imported.
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
}));

vi.mock("@/lib/api/portfolio", async () => {
  // Import the real module so we can re-use `listPortfolioItems` as a
  // known function shape — but we replace it (plus `getPortfolioItemAnalysis`
  // and `retryPortfolioItemAnalysis`) with `vi.fn()`s the test bodies
  // override via `mockReturnValue`.
  const actual =
    await vi.importActual<typeof import("@/lib/api/portfolio")>(
      "@/lib/api/portfolio",
    );
  return {
    ...actual,
    listPortfolioItems: vi.fn(),
    getPortfolioItemAnalysis: vi.fn(),
    retryPortfolioItemAnalysis: vi.fn(),
    updateItemSharing: vi.fn(),
  };
});

vi.mock("@/lib/api/discovery", async () => {
  // STOR-44 Phase 3: the detail page now fetches the searchable profile
  // to drive the per-item sharing card. Mock the module so the page's
  // getSearchableProfile call doesn't reach the network — each test
  // overrides `mockReturnValue` for the success path or
  // `mockRejectedValue` for the failure path.
  const actual =
    await vi.importActual<typeof import("@/lib/api/discovery")>(
      "@/lib/api/discovery",
    );
  return {
    ...actual,
    getSearchableProfile: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import {
  getPortfolioItemAnalysis,
  listPortfolioItems,
  retryPortfolioItemAnalysis,
  type PortfolioItem,
  type PortfolioItemAnalysis,
} from "@/lib/api/portfolio";
import { getSearchableProfile } from "@/lib/api/discovery";

import {
  makePortfolioItem,
  makePortfolioItemAnalysis,
} from "../test-helpers";

import PortfolioItemDetailPage from "./page";

const ITEM_ID = "item-001";
const ACCESS_TOKEN = "test-access-token";

// Local thin aliases so the existing test bodies don't need to be touched.
// `makeItem` was the file's original name; `makeAnalysis` similarly.
const makeItem = makePortfolioItem;
const makeAnalysis = makePortfolioItemAnalysis;

/** All session + params + list-fetch mocks wired up to a successful fetch
 * with the supplied item + analysis. The two fetch mocks return promises
 * that resolve synchronously on the next microtick (Vitest's default
 * behavior for `mockResolvedValue`). */
function setupMocks(item: PortfolioItem, analysis: PortfolioItemAnalysis) {
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN } as never,
    status: "authenticated",
  } as never);
  vi.mocked(useParams).mockReturnValue({ id: ITEM_ID } as never);
  vi.mocked(listPortfolioItems).mockResolvedValue({
    items: [item],
    pageNumber: 1,
    pageSize: 100,
    totalCount: 1,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false,
  });
  vi.mocked(getPortfolioItemAnalysis).mockResolvedValue(analysis);
  // Default: the student has NOT turned on employer visibility. Tests
  // that exercise the on-state of the sharing card override this.
  vi.mocked(getSearchableProfile).mockResolvedValue({
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
  });
}

describe("PortfolioItemDetailPage — Analyzed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders every skill name, confidence-band label, and explanation", async () => {
    const item = makeItem();
    const analysis = makeAnalysis({
      skills: [
        {
          skillName: "Technical writing",
          confidenceBand: "Strong",
          explanation:
            "Clear structure, concise prose, and a thorough methodology section.",
        },
        {
          skillName: "Data visualization",
          confidenceBand: "Developing",
          explanation:
            "Includes some charts but they could be clearer with better labels.",
        },
        {
          skillName: "Statistical analysis",
          confidenceBand: "Missing",
          explanation: "No statistical methods were applied.",
        },
      ],
    });
    setupMocks(item, analysis);

    render(<PortfolioItemDetailPage />);

    // Wait for the async initial fetches to resolve and re-render.
    expect(
      await screen.findByText("Technical writing"),
    ).toBeInTheDocument();
    expect(screen.getByText("Data visualization")).toBeInTheDocument();
    expect(screen.getByText("Statistical analysis")).toBeInTheDocument();

    // Confidence-band labels — exact text strings from the approved design.
    expect(screen.getByText("Strong")).toBeInTheDocument();
    expect(screen.getByText("Developing")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();

    // Each explanation body.
    expect(
      screen.getByText(
        "Clear structure, concise prose, and a thorough methodology section.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Includes some charts but they could be clearer with better labels.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No statistical methods were applied."),
    ).toBeInTheDocument();

    // Header still shows the item label + category pill.
    expect(
      screen.getByRole("heading", { name: /capstone project writeup/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Document")).toBeInTheDocument();

    // The status badge in the header should show "Analyzed" (from
    // analysis.status, which is the source of truth on the detail page).
    const analyzedBadges = screen.getAllByText("Analyzed");
    expect(analyzedBadges.length).toBeGreaterThan(0);
  });
});

describe("PortfolioItemDetailPage — Retry button visibility per status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: ACCESS_TOKEN } as never,
      status: "authenticated",
    } as never);
    vi.mocked(useParams).mockReturnValue({ id: ITEM_ID } as never);
  });

  it("renders and enables the Retry button only when status === Failed", async () => {
    const item = makeItem({ analysisStatus: "Failed", lastAnalyzedAt: null });
    const analysis = makeAnalysis({
      status: "Failed",
      lastAnalyzedAt: null,
      errorMessage: "The file could not be parsed.",
    });
    setupMocks(item, analysis);

    render(<PortfolioItemDetailPage />);

    const retryButton = await screen.findByRole("button", {
      name: /retry analysis/i,
    });
    expect(retryButton).toBeInTheDocument();
    expect(retryButton).not.toBeDisabled();
  });

  it("does NOT render the Retry button when status is Analyzed", async () => {
    const item = makeItem();
    const analysis = makeAnalysis({ status: "Analyzed" });
    setupMocks(item, analysis);

    render(<PortfolioItemDetailPage />);

    // Wait until the Analyzed card has rendered (any skill would do, even
    // with an empty array — the heading "Skills found" appears regardless).
    expect(
      await screen.findByRole("heading", { name: /skills found/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /retry analysis/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT render the Retry button when status is Unsupported", async () => {
    const item = makeItem({ analysisStatus: "Unsupported" });
    const analysis = makeAnalysis({
      status: "Unsupported",
      lastAnalyzedAt: null,
      errorMessage: null,
    });
    setupMocks(item, analysis);

    render(<PortfolioItemDetailPage />);

    expect(
      await screen.findByRole("heading", {
        name: /we can.?t analyze this file type yet/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /retry analysis/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT render the Retry button while status is NotAnalyzed (loading card)", async () => {
    const item = makeItem({ analysisStatus: "NotAnalyzed", lastAnalyzedAt: null });
    const analysis = makeAnalysis({
      status: "NotAnalyzed",
      lastAnalyzedAt: null,
      errorMessage: null,
    });
    setupMocks(item, analysis);

    render(<PortfolioItemDetailPage />);

    expect(
      await screen.findByRole("heading", {
        name: /analyzing your submission/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /retry analysis/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT render the Retry button while status is Analyzing (loading card)", async () => {
    const item = makeItem({ analysisStatus: "Analyzing", lastAnalyzedAt: null });
    const analysis = makeAnalysis({
      status: "Analyzing",
      lastAnalyzedAt: null,
      errorMessage: null,
    });
    setupMocks(item, analysis);

    render(<PortfolioItemDetailPage />);

    expect(
      await screen.findByRole("heading", {
        name: /analyzing your submission/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /retry analysis/i }),
    ).not.toBeInTheDocument();
  });
});

describe("PortfolioItemDetailPage — Retry should not blank the page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: ACCESS_TOKEN } as never,
      status: "authenticated",
    } as never);
    vi.mocked(useParams).mockReturnValue({ id: ITEM_ID } as never);
  });

  /**
   * Regression guard for the "click Retry → whole page flashes Loading…"
   * bug. The main data-fetching useEffect must NOT reset `detail` to
   * `{ status: "loading" }` when it re-runs because of a successful Retry
   * bump — the prior successful snapshot stays rendered until the fresh
   * Promise.all resolves, so the header card (item label, back link, status
   * badge) never disappears mid-interaction.
   *
   * To assert the in-between state — not just before/after — we use
   * manually-controlled deferred promises for BOTH the retry POST and the
   * subsequent list + analysis fetches. We resolve them in turn only after
   * we've already asserted that the header is still there.
   */
  it("keeps the header card visible between click and the retry refetch resolving", async () => {
    const item = makeItem({
      label: "Capstone Project Writeup",
      analysisStatus: "Failed",
      lastAnalyzedAt: null,
    });
    const failedAnalysis = makeAnalysis({
      status: "Failed",
      lastAnalyzedAt: null,
      errorMessage: "The file could not be parsed.",
    });
    // 1) Initial mount: both fetches resolve immediately so we render the
    //    Failed card before clicking anything.
    setupMocks(item, failedAnalysis);

    render(<PortfolioItemDetailPage />);

    // Sanity: header + Failed card both rendered before the click.
    const itemHeading = await screen.findByRole("heading", {
      name: /capstone project writeup/i,
    });
    expect(itemHeading).toBeInTheDocument();
    const retryButton = await screen.findByRole("button", {
      name: /retry analysis/i,
    });
    expect(retryButton).toBeInTheDocument();

    // 2) Override the mocks with deferred (manually-controlled) versions
    //    so we can pause the test in the in-between state.
    let resolveRetry: (v: { portfolioItemId: string; newJobId: string }) => void = () => {};
    let resolveAnalysis: (v: PortfolioItemAnalysis) => void = () => {};
    let resolveList: (v: Awaited<ReturnType<typeof listPortfolioItems>>) => void = () => {};

    const retryPromise = new Promise<{ portfolioItemId: string; newJobId: string }>((res) => {
      resolveRetry = res;
    });
    const analysisPromise = new Promise<PortfolioItemAnalysis>((res) => {
      resolveAnalysis = res;
    });
    const listPromise = new Promise<Awaited<ReturnType<typeof listPortfolioItems>>>(
      (res) => {
        resolveList = res;
      },
    );

    // The retry POST is the first thing that goes pending on click. We
    // queue a NEW fetch behaviour AFTER the retry resolves — so we set the
    // analysis / list mocks to deferred promises but we ALSO have to make
    // sure the FIRST call (the one already wired up by setupMocks) doesn't
    // re-fire with these new pending promises mid-mount. The cleanest way
    // is to replace the mock impl AFTER the initial mount is settled but
    // BEFORE the click. clearAllMocks + reassignment below replaces all
    // three mocks cleanly for everything that happens post-click.
    vi.mocked(retryPortfolioItemAnalysis).mockImplementation(() => retryPromise);
    vi.mocked(getPortfolioItemAnalysis).mockImplementation(() => analysisPromise);
    vi.mocked(listPortfolioItems).mockImplementation(
      () => listPromise as ReturnType<typeof listPortfolioItems>,
    );

    // 3) Click the Retry button. The POST is now pending, the subsequent
    //    refresh-version-driven fetch is also pending — we're in the
    //    in-between state.
    fireEvent.click(retryButton);

    // Give React a microtask to flush any synchronous state updates
    // triggered by the click handler (setRetrying(true), etc.). We do NOT
    // need to wait for any Promise to settle here — the promises are
    // explicitly deferred.
    await Promise.resolve();

    // 4) THE ASSERTION: the item label heading is STILL in the document
    //    while both the retry POST and the refetch are pending. Before the
    //    guard fix, this would fail because the page would have re-rendered
    //    with the bare "Loading…" placeholder (no header card).
    expect(
      screen.getByRole("heading", { name: /capstone project writeup/i }),
    ).toBeInTheDocument();

    // Back link still present too — proves the wrapper markup stayed up,
    // not just the heading.
    expect(screen.getByText(/back to portfolio/i)).toBeInTheDocument();

    // 5) Now let the retry POST resolve. The handler will then bump
    //    refreshVersion, scheduling a new effect run; but that new run
    //    picks up the STILL-pending list / analysis mocks, so we remain
    //    in the in-between state. Header should still be there.
    await act(async () => {
      resolveRetry({ portfolioItemId: ITEM_ID, newJobId: "job-001" });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByRole("heading", { name: /capstone project writeup/i }),
    ).toBeInTheDocument();

    // 6) Finally let the refetch land — the page should swap from the
    //    Failed card to the Analyzing card. The header card itself stays
    //    rendered throughout (now showing the Analyzing status badge).
    await act(async () => {
      resolveList({
        items: [item],
        pageNumber: 1,
        pageSize: 100,
        totalCount: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      });
      resolveAnalysis(
        makeAnalysis({
          status: "Analyzing",
          lastAnalyzedAt: null,
          errorMessage: null,
        }),
      );
    });

    expect(
      await screen.findByRole("heading", { name: /analyzing your submission/i }),
    ).toBeInTheDocument();
    // Header card persists across the swap.
    expect(
      screen.getByRole("heading", { name: /capstone project writeup/i }),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// STOR-44 Phase 3 — ItemSharingCard integration. The detail page now renders
// the per-item "Employer access" card below the header. The card's
// `isSearchable` prop is driven by the parallel `getSearchableProfile` call;
// the card's PUT goes through `updateItemSharing` (mocked at the top).
// ---------------------------------------------------------------------------

describe("PortfolioItemDetailPage — STOR-44 Employer access card", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: ACCESS_TOKEN } as never,
      status: "authenticated",
    } as never);
    vi.mocked(useParams).mockReturnValue({ id: ITEM_ID } as never);
  });

  it("renders the card below the item header with the item's sharing flag", async () => {
    const item = makeItem({ shareOriginalWithEmployers: true });
    const analysis = makeAnalysis();
    setupMocks(item, analysis);
    // Searchable so the switch is enabled and reflects the item's flag.
    vi.mocked(getSearchableProfile).mockResolvedValue({
      isSearchable: true,
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
      visibleItemCount: 1,
    } as never);

    render(<PortfolioItemDetailPage />);

    // Header still renders.
    expect(
      await screen.findByRole("heading", { name: /capstone project writeup/i }),
    ).toBeInTheDocument();
    // The card's "Employer access" heading is below the item header.
    expect(
      screen.getByRole("heading", { name: /^employer access$/i }),
    ).toBeInTheDocument();
    // Switch reflects the item's persisted value (true).
    const sw = screen.getByRole("switch", { name: /employer access/i });
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("renders the disabled state when getSearchableProfile resolves with isSearchable=false", async () => {
    const item = makeItem({ shareOriginalWithEmployers: false });
    const analysis = makeAnalysis();
    setupMocks(item, analysis);
    // setupMocks already returns isSearchable: false by default; just be
    // explicit for this case.
    vi.mocked(getSearchableProfile).mockResolvedValue({
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
    });

    render(<PortfolioItemDetailPage />);

    // Header + the rest of the page render regardless of the profile state.
    expect(
      await screen.findByRole("heading", { name: /capstone project writeup/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/skills found/i)).toBeInTheDocument();
    // The disabled card state shows.
    expect(
      screen.getByText(/turn on employer visibility to use this\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /go to employer visibility/i }),
    ).toHaveAttribute("href", "/dashboard/visibility");
    // Switch is locked off.
    const sw = screen.getByRole("switch", { name: /employer access/i });
    expect(sw).toBeDisabled();
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("falls back to the disabled state (and keeps the rest of the page rendering) when getSearchableProfile rejects", async () => {
    const item = makeItem({ shareOriginalWithEmployers: true });
    const analysis = makeAnalysis();
    setupMocks(item, analysis);
    // A profile fetch failure must not break the page; the card just
    // renders its disabled state.
    vi.mocked(getSearchableProfile).mockRejectedValue(new Error("network down"));

    render(<PortfolioItemDetailPage />);

    // Header + the skills card both render — page is alive.
    expect(
      await screen.findByRole("heading", { name: /capstone project writeup/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/skills found/i)).toBeInTheDocument();

    // The card rendered in its disabled state (locked off).
    await waitFor(() => {
      expect(
        screen.getByText(/turn on employer visibility to use this\./i),
      ).toBeInTheDocument();
    });
    const sw = screen.getByRole("switch", { name: /employer access/i });
    expect(sw).toBeDisabled();
  });

  it("a successful sharing flip updates the card's persisted flag without re-fetching analysis", async () => {
    const item = makeItem({ shareOriginalWithEmployers: false });
    const analysis = makeAnalysis();
    setupMocks(item, analysis);
    vi.mocked(getSearchableProfile).mockResolvedValue({
      isSearchable: true,
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
      visibleItemCount: 1,
    });

    const { updateItemSharing } = await import("@/lib/api/portfolio");
    vi.mocked(updateItemSharing).mockResolvedValue({
      ...item,
      shareOriginalWithEmployers: true,
    });

    render(<PortfolioItemDetailPage />);

    // Wait for the initial render + the initial fetches to settle, then
    // snapshot the analysis call count BEFORE we trigger the toggle.
    const sw = await screen.findByRole("switch", { name: /employer access/i });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await waitFor(() => {
      expect(screen.getByText(/skills found/i)).toBeInTheDocument();
    });
    const analysisCallsBefore = vi.mocked(getPortfolioItemAnalysis).mock.calls.length;

    fireEvent.click(sw);

    await waitFor(() => {
      expect(updateItemSharing).toHaveBeenCalledWith(
        ACCESS_TOKEN,
        item.id,
        true,
        expect.anything(),
      );
    });

    await waitFor(() => {
      expect(sw).toHaveAttribute("aria-checked", "true");
    });

    // No extra analysis fetches were triggered — the shareOriginal flag
    // is independent of the AI analysis rollup.
    expect(vi.mocked(getPortfolioItemAnalysis).mock.calls.length).toBe(
      analysisCallsBefore,
    );
  });
});
