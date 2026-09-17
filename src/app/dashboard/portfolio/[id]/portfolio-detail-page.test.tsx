import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

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

import PortfolioItemDetailPage from "./page";

const ITEM_ID = "item-001";
const ACCESS_TOKEN = "test-access-token";

/** Builds a PortfolioItem fixture whose analysis-related fields default to
 * the caller-provided analysis. Keeps each test shorter than re-declaring
 * the full shape. */
function makeItem(overrides: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    id: ITEM_ID,
    label: "Capstone Project Writeup",
    category: "Document",
    customCategoryText: null,
    submissionType: "File",
    originalFileName: "capstone.pdf",
    contentType: "application/pdf",
    fileSizeBytes: 1024 * 250,
    externalUrl: null,
    description: null,
    createdAt: "2026-09-10T00:00:00Z",
    analysisStatus: "Analyzed",
    lastAnalyzedAt: "2026-09-10T00:05:00Z",
    // STOR-39 — `skills` is the condensed per-item preview surfaced on the
    // timeline list endpoint. Empty by default because the detail page
    // already loads the full per-item analysis via `getPortfolioItemAnalysis`
    // and reads `analysis.skills` from there; tests that need condensed
    // skills can override this field on the fixture.
    skills: [],
    ...overrides,
  };
}

function makeAnalysis(overrides: Partial<PortfolioItemAnalysis> = {}): PortfolioItemAnalysis {
  return {
    status: "Analyzed",
    lastAnalyzedAt: "2026-09-10T00:05:00Z",
    errorMessage: null,
    skills: [],
    ...overrides,
  };
}

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
