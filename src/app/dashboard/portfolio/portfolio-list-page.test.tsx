import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

// Mocks MUST be hoisted before the page module is imported.
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/api/portfolio", async () => {
  // Import the real module so we can re-use the type-only exports as
  // known function shapes — but we replace `listPortfolioItems`,
  // `deletePortfolioItem`, and `uploadPortfolioItem` with `vi.fn()`s the
  // test bodies override via `mockResolvedValue`. The form's upload path is
  // not exercised by any test in this file (the timeline tests only delete);
  // we mock it so a stray render never tries to hit the network.
  const actual =
    await vi.importActual<typeof import("@/lib/api/portfolio")>(
      "@/lib/api/portfolio",
    );
  return {
    ...actual,
    listPortfolioItems: vi.fn(),
    deletePortfolioItem: vi.fn(),
    uploadPortfolioItem: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import {
  deletePortfolioItem,
  listPortfolioItems,
  type PortfolioItem,
} from "@/lib/api/portfolio";

import PortfolioPage from "./page";

const ACCESS_TOKEN = "test-access-token";

/** Builds a PortfolioItem fixture with sensible defaults; tests override
 * the analysis-related fields + skills as needed. */
function makeItem(overrides: Partial<PortfolioItem> = {}): PortfolioItem {
  return {
    id: `item-${Math.random().toString(36).slice(2, 8)}`,
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
    skills: [],
    ...overrides,
  };
}

/** Wires the session + list-fetch mocks up to a successful fetch with the
 * supplied items. Returns the listItems spy for per-test overrides. */
function setupMocks(items: PortfolioItem[]) {
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN } as never,
    status: "authenticated",
  } as never);
  vi.mocked(listPortfolioItems).mockResolvedValue({
    items,
    pageNumber: 1,
    pageSize: 100,
    totalCount: items.length,
    totalPages: 1,
    hasPrevious: false,
    hasNext: false,
  });
  vi.mocked(deletePortfolioItem).mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PortfolioPage — populated timeline", () => {
  it("renders the timeline with one entry per item, newest-first", async () => {
    const newer = makeItem({
      id: "newer",
      label: "Newer Item",
      createdAt: "2026-09-15T00:00:00Z",
      skills: [
        { skillName: "Technical writing", confidenceBand: "Strong" },
      ],
    });
    const older = makeItem({
      id: "older",
      label: "Older Item",
      createdAt: "2026-09-01T00:00:00Z",
      analysisStatus: "NotAnalyzed",
      lastAnalyzedAt: null,
      skills: [],
    });
    setupMocks([newer, older]);

    render(<PortfolioPage />);

    // Timeline landmark appears after the fetch resolves.
    const timeline = await screen.findByRole("list", {
      name: /portfolio timeline/i,
    });
    expect(timeline).toBeInTheDocument();

    // Both labels render. The list endpoint returns them in newest-first
    // order (the existing sort), and the timeline preserves that order.
    expect(screen.getByText("Newer Item")).toBeInTheDocument();
    expect(screen.getByText("Older Item")).toBeInTheDocument();

    // Each entry's status badge label is in the document.
    // `Analyzed` and `Not analyzed` are the two distinct statuses used here.
    expect(screen.getAllByText("Analyzed").length).toBeGreaterThan(0);
    expect(screen.getByText("Not analyzed")).toBeInTheDocument();
  });

  it("renders exactly the skill names passed in for an analyzed item, colored per band", async () => {
    const item = makeItem({
      id: "analyzed-with-skills",
      label: "Analyzed With Skills",
      analysisStatus: "Analyzed",
      skills: [
        { skillName: "Technical writing", confidenceBand: "Strong" },
        { skillName: "Data visualization", confidenceBand: "Developing" },
      ],
    });
    setupMocks([item]);

    render(<PortfolioPage />);

    // Skill names render in the skill strip (the same string may also
    // appear elsewhere — we just need them to be present, which findBy*
    // confirms).
    expect(
      await screen.findByText("Technical writing"),
    ).toBeInTheDocument();
    expect(screen.getByText("Data visualization")).toBeInTheDocument();

    // Band labels — the condensed preview shows "Skill · Band" inside a
    // single Badge per skill. `screen.getByText` on the band label finds
    // both the badge's band label AND the standalone status badge text.
    // Multiple matches are fine — what we need to prove is that the band
    // labels appear, not that they appear exactly once.
    expect(screen.getAllByText("Strong").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Developing").length).toBeGreaterThan(0);
  });

  it("shows no skill badges for a not-analyzed item — only its status badge", async () => {
    const item = makeItem({
      id: "not-analyzed",
      label: "Not Yet Analyzed",
      analysisStatus: "NotAnalyzed",
      lastAnalyzedAt: null,
      skills: [],
    });
    setupMocks([item]);

    render(<PortfolioPage />);

    // Wait for the timeline to render the label + status badge.
    expect(
      await screen.findByText("Not Yet Analyzed"),
    ).toBeInTheDocument();

    // Status badge text.
    expect(screen.getByText("Not analyzed")).toBeInTheDocument();

    // The timeline's skill-strip region should not be present at all — the
    // strip is only rendered when `analysisStatus === "Analyzed" && skills.length > 0`.
    // We check via the data-testid-like query: the strip wraps badges in a
    // div with no label/role, so the most reliable negative assertion is
    // that no badge with a band-label text appears for this item.
    expect(screen.queryByText("Strong")).not.toBeInTheDocument();
    expect(screen.queryByText("Developing")).not.toBeInTheDocument();
    expect(screen.queryByText("Missing")).not.toBeInTheDocument();
  });

  it("does NOT render skill badges when the item is Analyzed but skills: []", async () => {
    const item = makeItem({
      id: "analyzed-no-skills",
      label: "Analyzed But Empty",
      analysisStatus: "Analyzed",
      // Defense-in-depth: keep skills: [] even though the item is Analyzed.
      // The timeline should still hide the strip.
      skills: [],
    });
    setupMocks([item]);

    render(<PortfolioPage />);

    expect(
      await screen.findByText("Analyzed But Empty"),
    ).toBeInTheDocument();

    expect(screen.queryByText("Strong")).not.toBeInTheDocument();
    expect(screen.queryByText("Developing")).not.toBeInTheDocument();
    expect(screen.queryByText("Missing")).not.toBeInTheDocument();
  });

  it("caps the visible skill badges and shows a +N more overflow indicator", async () => {
    const item = makeItem({
      id: "many-skills",
      label: "Many Skills",
      analysisStatus: "Analyzed",
      skills: [
        { skillName: "Skill A", confidenceBand: "Strong" },
        { skillName: "Skill B", confidenceBand: "Developing" },
        { skillName: "Skill C", confidenceBand: "Missing" },
        { skillName: "Skill D", confidenceBand: "Strong" },
        { skillName: "Skill E", confidenceBand: "Strong" },
      ],
    });
    setupMocks([item]);

    render(<PortfolioPage />);

    // The first three are visible.
    expect(await screen.findByText("Skill A")).toBeInTheDocument();
    expect(screen.getByText("Skill B")).toBeInTheDocument();
    expect(screen.getByText("Skill C")).toBeInTheDocument();

    // The overflow: 2 (5 - 3) — should appear as "+2 more".
    expect(screen.getByText("+2 more")).toBeInTheDocument();

    // The trailing two must NOT render as standalone skill badges.
    expect(screen.queryByText("Skill D")).not.toBeInTheDocument();
    expect(screen.queryByText("Skill E")).not.toBeInTheDocument();
  });

  it("navigates to the detail page when an entry's link is clicked", async () => {
    const item = makeItem({
      id: "link-target",
      label: "Link Target",
      submissionType: "Link",
      externalUrl: "https://example.com/project",
      originalFileName: null,
      contentType: null,
      fileSizeBytes: null,
    });
    setupMocks([item]);

    render(<PortfolioPage />);

    const link = await screen.findByRole("link", { name: /link target/i });
    expect(link).toHaveAttribute("href", "/dashboard/portfolio/link-target");
  });

  it("uses the file-type icon for File submissions and the link icon for Link submissions", async () => {
    const fileItem = makeItem({
      id: "f",
      label: "File Item",
      submissionType: "File",
    });
    const linkItem = makeItem({
      id: "l",
      label: "Link Item",
      submissionType: "Link",
      originalFileName: null,
      contentType: null,
      fileSizeBytes: null,
      externalUrl: "https://example.com",
    });
    setupMocks([fileItem, linkItem]);

    render(<PortfolioPage />);

    await screen.findByText("File Item");
    await screen.findByText("Link Item");

    // Lucide-react icons render as plain SVGs without an `img` role. Count
    // SVGs in the timeline rows specifically — both rows together carry
    // (status icon + type icon) = 2 each, plus spine dots. We assert at
    // least 4 SVGs appear, proving the icon branches ran for both items.
    const timeline = screen.getByRole("list", { name: /portfolio timeline/i });
    const svgs = timeline.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(4);
  });
});

describe("PortfolioPage — empty state", () => {
  it("renders the empty-state card when the fetch returns zero items", async () => {
    setupMocks([]);

    render(<PortfolioPage />);

    expect(
      await screen.findByRole("heading", { name: /your portfolio is empty/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/add your first file or link above/i),
    ).toBeInTheDocument();
  });

  it("does NOT render the timeline landmark when there are zero items", async () => {
    setupMocks([]);

    render(<PortfolioPage />);

    // Wait for the empty state to appear first.
    await screen.findByRole("heading", { name: /your portfolio is empty/i });
    expect(
      screen.queryByRole("list", { name: /portfolio timeline/i }),
    ).not.toBeInTheDocument();
  });
});

describe("PortfolioPage — error state with retry", () => {
  it("renders the error card on a failed fetch", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: ACCESS_TOKEN } as never,
      status: "authenticated",
    } as never);
    vi.mocked(listPortfolioItems).mockRejectedValue(
      new Error("network down"),
    );

    render(<PortfolioPage />);

    expect(
      await screen.findByRole("heading", {
        name: /couldn.?t load your portfolio/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /retry/i }),
    ).toBeInTheDocument();
  });

  it("clicking Retry re-invokes listPortfolioItems and recovers to the populated state", async () => {
    const item = makeItem({ id: "after-retry", label: "After Retry" });

    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: ACCESS_TOKEN } as never,
      status: "authenticated",
    } as never);
    // First call rejects; second call resolves with one item.
    vi.mocked(listPortfolioItems)
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValueOnce({
        items: [item],
        pageNumber: 1,
        pageSize: 100,
        totalCount: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      });

    render(<PortfolioPage />);

    // Wait for the error UI to appear, then click Retry.
    const retryButton = await screen.findByRole("button", { name: /retry/i });
    fireEvent.click(retryButton);

    // The second mock now resolves — the timeline should appear with the
    // recovered item. `findByText` waits for the DOM to update.
    expect(await screen.findByText("After Retry")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: /couldn.?t load your portfolio/i,
      }),
    ).not.toBeInTheDocument();
  });
});

describe("PortfolioPage — delete behavior", () => {
  it("removes an item optimistically and keeps it gone after the request resolves", async () => {
    const item1 = makeItem({ id: "keep-me", label: "Keep Me" });
    const item2 = makeItem({ id: "delete-me", label: "Delete Me" });
    setupMocks([item1, item2]);

    render(<PortfolioPage />);

    // Wait for both rows to render before clicking.
    expect(await screen.findByText("Delete Me")).toBeInTheDocument();
    expect(screen.getByText("Keep Me")).toBeInTheDocument();

    const deleteButton = screen.getByRole("button", {
      name: /delete delete me/i,
    });
    fireEvent.click(deleteButton);

    // Optimistic: the row vanishes immediately, without waiting for the
    // mocked `deletePortfolioItem` promise to resolve.
    await waitFor(() => {
      expect(screen.queryByText("Delete Me")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Keep Me")).toBeInTheDocument();

    // The mocked DELETE call fired with the right id.
    await waitFor(() => {
      expect(vi.mocked(deletePortfolioItem)).toHaveBeenCalledWith(
        "delete-me",
        ACCESS_TOKEN,
      );
    });
  });
});

describe("PortfolioPage — submission form is untouched", () => {
  it("still renders the submission form section above the timeline", async () => {
    setupMocks([]);

    render(<PortfolioPage />);

    // The submission form's label input + "Add to portfolio" submit button
    // + the file/link tab pair are all in scope of the untouched form.
    expect(
      await screen.findByRole("heading", { name: /my portfolio/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /upload a file/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /paste a link/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^label$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^category$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add to portfolio/i }),
    ).toBeInTheDocument();
  });
});
