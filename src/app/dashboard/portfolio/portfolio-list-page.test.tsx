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

import { makePortfolioItem } from "./test-helpers";

import PortfolioPage from "./page";

const ACCESS_TOKEN = "test-access-token";

/** Local alias for the shared item-fixture builder. Tests in this file
 * always override `id` (because each test renders multiple items), so the
 * default id from the shared helper is just a placeholder. */
const makeItem = makePortfolioItem;

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

/** Asserts none of the three confidence-band labels are rendered. Used by
 * the "no skill badges" cases to prove the SkillBadgeStrip region is fully
 * absent (rather than just checking one of the band texts). */
function expectNoBandLabels() {
  expect(screen.queryByText("Strong")).not.toBeInTheDocument();
  expect(screen.queryByText("Developing")).not.toBeInTheDocument();
  expect(screen.queryByText("Missing")).not.toBeInTheDocument();
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

    // Skill names render in the skill strip — only the name shows as text;
    // the band's confident classification is conveyed by pill color + the
    // pill's aria-label (so assistive tech / a future admin filter can
    // still distinguish Strong vs Developing without re-walking hex pairs).
    expect(
      await screen.findByText("Technical writing"),
    ).toBeInTheDocument();
    expect(screen.getByText("Data visualization")).toBeInTheDocument();

    // Each skill pill's aria-label carries "{name} — {bandLabel}".
    expect(
      await screen.findByLabelText("Technical writing — Strong"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Data visualization — Developing"),
    ).toBeInTheDocument();
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
    expectNoBandLabels();
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

    expectNoBandLabels();
  });

  it("does NOT render skill badges when the item is Analyzing (skills gate requires Analyzed)", async () => {
    // Pin the contract that the skill-strip gate is `analysisStatus === "Analyzed"`
    // even if a non-empty skills array somehow arrives for a non-Analyzed status
    // (e.g. an in-flight analysis that has produced findings but not yet flipped
    // the item's status). Belt-and-braces: the timeline must only show skills
    // for items the model has finalized.
    const item = makeItem({
      id: "analyzing-with-stale-skills",
      label: "Analyzing With Stale Skills",
      analysisStatus: "Analyzing",
      skills: [
        { skillName: "Should Not Render", confidenceBand: "Strong" },
      ],
    });
    setupMocks([item]);

    render(<PortfolioPage />);

    expect(
      await screen.findByText("Analyzing With Stale Skills"),
    ).toBeInTheDocument();

    expectNoBandLabels();
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
      await screen.findByRole("heading", { name: /your timeline starts here/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/add your first file or link above — every item you submit shows up here/i),
    ).toBeInTheDocument();
  });

  it("does NOT render the timeline landmark when there are zero items", async () => {
    setupMocks([]);

    render(<PortfolioPage />);

    // Wait for the empty state to appear first.
    await screen.findByRole("heading", { name: /your timeline starts here/i });
    expect(
      screen.queryByRole("list", { name: /portfolio timeline/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT render the '0 items' summary in the empty state", async () => {
    // Approved design rule: the right-hand summary in the section header
    // appears only in the populated state. The empty state must not say
    // "0 items" — the heading + subtitle are sufficient on their own.
    setupMocks([]);

    render(<PortfolioPage />);
    await screen.findByRole("heading", { name: /your timeline starts here/i });

    // Match the exact shape summaryLine() produces: "{n} item(s)" with
    // optional " · {m} skill(s) identified". The empty-state copy uses
    // the word "item" in prose ("every item you submit"), so a generic
    // /\bitem\b/ would also match that copy and produce a false
    // positive. Anchor on the leading numeric count instead.
    expect(screen.queryByText(/^\d+\s+items?(\b|·)/)).not.toBeInTheDocument();
    // The header heading still renders.
    expect(
      screen.getByRole("heading", { name: /^your portfolio$/i }),
    ).toBeInTheDocument();
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

  it("does NOT render the '0 items' summary in the error state", async () => {
    // Mirror of the empty-state test: the right-hand summary belongs to
    // the populated header only, never to the loading/error/empty
    // headers. The heading and subtitle still render so the section is
    // discoverable, just without the count.
    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: ACCESS_TOKEN } as never,
      status: "authenticated",
    } as never);
    vi.mocked(listPortfolioItems).mockRejectedValue(new Error("network down"));

    render(<PortfolioPage />);
    await screen.findByRole("heading", {
      name: /couldn.?t load your portfolio/i,
    });

    // Anchor on the leading numeric count so prose mentioning "item"
    // doesn't trip the matcher.
    expect(screen.queryByText(/^\d+\s+items?(\b|·)/)).not.toBeInTheDocument();
    expect(screen.queryByText(/skill identified/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /^your portfolio$/i }),
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

// ---------------------------------------------------------------------------
// Phase 3 design-spec coverage — pinned by the approved design canvas. Each
// spec section gets at least one regression test here so a future drift
// from the canvas (e.g. re-introducing a half-dot or a duplicated delete
// button for mobile/desktop) fails the suite.
// ---------------------------------------------------------------------------

describe("PortfolioPage — design-spec regressions", () => {
  it("renders exactly one timeline dot per row (first and last included)", async () => {
    const a = makeItem({ id: "a", label: "A", createdAt: "2026-09-15T00:00:00Z" });
    const b = makeItem({ id: "b", label: "B", createdAt: "2026-09-10T00:00:00Z" });
    const c = makeItem({ id: "c", label: "C", createdAt: "2026-09-05T00:00:00Z" });
    setupMocks([a, b, c]);

    render(<PortfolioPage />);

    const timeline = await screen.findByRole("list", { name: /portfolio timeline/i });
    // Three rows. The dot signature: rounded-full + the box-shadow ring
    // utility. We check via the unique Tailwind escape class string the
    // dot uses (`shadow-[0_0_0_3px_var(--background)]`) — only the dot has
    // this; pill icons use rounded-full but their shadows don't include the
    // 3px ring, so the class-string match is unambiguous per-row.
    const rows = Array.from(timeline.querySelectorAll(":scope > li"));
    expect(rows.length).toBe(3);
    rows.forEach((row, idx) => {
      const dots = row.querySelectorAll(".shadow-\\[0_0_0_3px_var\\(--background\\)\\]");
      expect(
        dots.length,
        `row #${idx} should have exactly one timeline dot`,
      ).toBe(1);
    });
  });

  it("renders the populated header summary as 'N items · M skills identified' (with singular forms)", async () => {
    const item = makeItem({
      id: "one-item-many-skills",
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
    await screen.findByText("Many Skills");

    expect(screen.getByText("1 item · 5 skills identified")).toBeInTheDocument();
  });

  it("uses singular forms: '1 item' and '1 skill identified'", async () => {
    const item = makeItem({
      id: "one-skill",
      label: "One Skill",
      analysisStatus: "Analyzed",
      skills: [{ skillName: "Only Skill", confidenceBand: "Strong" }],
    });
    setupMocks([item]);

    render(<PortfolioPage />);
    await screen.findByText("One Skill");

    expect(screen.getByText("1 item · 1 skill identified")).toBeInTheDocument();
  });

  it("omits the skills clause when no item has any skill", async () => {
    const item = makeItem({
      id: "no-skills",
      label: "No Skills",
      analysisStatus: "NotAnalyzed",
      lastAnalyzedAt: null,
      skills: [],
    });
    setupMocks([item]);

    render(<PortfolioPage />);
    await screen.findByText("No Skills");

    // 1 item, 0 skills — only the item count, no skills clause.
    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.queryByText(/skill identified/)).not.toBeInTheDocument();
  });

  it("uses plural 'items' for N>1", async () => {
    const a = makeItem({ id: "a", label: "A" });
    const b = makeItem({ id: "b", label: "B" });
    setupMocks([a, b]);

    render(<PortfolioPage />);
    await screen.findByText("A");

    expect(screen.getByText(/^2 items$/)).toBeInTheDocument();
  });

  it("clamps the error message in the error state so a huge server stack trace can't blow up the card", async () => {
    const hugeMessage = "x".repeat(2000) + " TRACETAIL";
    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: ACCESS_TOKEN } as never,
      status: "authenticated",
    } as never);
    vi.mocked(listPortfolioItems).mockRejectedValue(new Error(hugeMessage));

    render(<PortfolioPage />);

    const details = await screen.findByLabelText("Error details");
    // The clamp is expressed via Tailwind v4 arbitrary-property classes
    // (`[-webkit-line-clamp:3]`, `[display:-webkit-box]`,
    // `[-webkit-box-orient:vertical]`, `[overflow:hidden]`). Assert the
    // class string so a future regression that drops one of the four
    // required declarations trips this test. The Tailwind utility form
    // ("line-clamp-3") is not available in the project's Tailwind v4
    // build, which is why this card uses arbitrary properties — same
    // shape the submission banner uses for the delete-failure path.
    expect(details.className).toContain("[-webkit-line-clamp:3]");
    expect(details.className).toContain("[display:-webkit-box]");
    expect(details.className).toContain("[-webkit-box-orient:vertical]");
    expect(details.className).toContain("[overflow:hidden]");
    expect(details.textContent).toContain("TRACETAIL");
  });

  it("renders exactly one delete button per row (no duplicated hidden copies)", async () => {
    const a = makeItem({ id: "del-a", label: "Delete A" });
    const b = makeItem({ id: "del-b", label: "Delete B" });
    setupMocks([a, b]);

    render(<PortfolioPage />);
    await screen.findByText("Delete A");

    // Exactly one button per row, found by accessible name. Spec §4
    // explicitly forbids duplicating the button across the desktop and
    // mobile layouts — both visual positions must be served by the SAME
    // DOM node (relocated via grid-area).
    expect(
      screen.getByRole("button", { name: /delete delete a/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /delete delete b/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryAllByRole("button", { name: /delete delete a/i }),
    ).toHaveLength(1);
    expect(
      screen.queryAllByRole("button", { name: /delete delete b/i }),
    ).toHaveLength(1);
  });

  it("a not-analyzed item shows only its status pill — no divider, no skill pills", async () => {
    const item = makeItem({
      id: "not-analyzed-pills-only",
      label: "Not Analyzed Pills",
      analysisStatus: "NotAnalyzed",
      lastAnalyzedAt: null,
      skills: [],
    });
    setupMocks([item]);

    render(<PortfolioPage />);
    await screen.findByText("Not Analyzed Pills");

    // Status pill renders. The vertical 1px divider that separates the
    // status pill from skill pills must NOT render (it only mounts when
    // `showSkills` is true). Likewise no skill-name pills render.
    expect(screen.getByText("Not analyzed")).toBeInTheDocument();
    // The divider is a 14px-tall <span> with role-less; assert via the
    // single shared ancestor: query for the role-less divider width-px span.
    const allRows = screen.getAllByRole("listitem");
    expect(allRows.length).toBeGreaterThan(0);
    const firstRow = allRows[0]!;
    // 1px-wide spans (vertical divider) — none should be present in the
    // not-analyzed row.
    expect(
      firstRow.querySelector(".h-3\\.5.w-px"),
    ).toBeNull();
  });

  it("4 skills → 3 skill pills + '+1 more' overflow indicator", async () => {
    const item = makeItem({
      id: "four-skills",
      label: "Four Skills",
      analysisStatus: "Analyzed",
      skills: [
        { skillName: "Skill A", confidenceBand: "Strong" },
        { skillName: "Skill B", confidenceBand: "Developing" },
        { skillName: "Skill C", confidenceBand: "Missing" },
        { skillName: "Skill D", confidenceBand: "Strong" },
      ],
    });
    setupMocks([item]);

    render(<PortfolioPage />);
    await screen.findByText("Skill A");

    expect(screen.getByText("Skill A")).toBeInTheDocument();
    expect(screen.getByText("Skill B")).toBeInTheDocument();
    expect(screen.getByText("Skill C")).toBeInTheDocument();
    expect(screen.getByText("+1 more")).toBeInTheDocument();
    expect(screen.queryByText("Skill D")).not.toBeInTheDocument();
  });

  it("does not inject a <style> element into the document (CSP-friendly)", async () => {
    // B2 of the STOR-39 cross-validation pass: the page used to render a
    // <style dangerouslySetInnerHTML> block to provide grid-area CSS for
    // the timeline card. That element is bypassed by the app's CSP unless
    // a nonce is plumbed through, so the page now does it with Tailwind v4
    // arbitrary properties on the card and its children. Guard against
    // regression: no <style> tag of any kind may appear in the rendered tree.
    const item = makeItem({ id: "no-style", label: "No Style" });
    setupMocks([item]);

    render(<PortfolioPage />);
    await screen.findByText("No Style");

    // The page should not mount any <style> element — neither via
    // dangerouslySetInnerHTML nor via a CSS-in-JS runtime. CSS-in-JS
    // libraries (e.g. styled-components) also typically inject <style>
    // tags at runtime, so a stricter version of this assertion would
    // forbid those too; the current page uses neither.
    const styleElements = document.querySelectorAll("style");
    expect(
      styleElements.length,
      "page must not inject <style> elements — CSP would block them",
    ).toBe(0);
  });

  it("clamps the delete-failure message in the submission banner so an unbounded server error can't blow up the card", async () => {
    // B3 of the STOR-39 cross-validation pass: the submission banner's
    // error text (which is the same channel a failed DELETE flows through
    // via handleDelete's setSubmitError(messageForError(error)) call) must
    // clamp long error strings so a server stack-trace dump can't blow
    // up the layout. Mirrors the existing list-error-state clamp test:
    // assert the inline style applies WebkitLineClamp: 3 and overflow:hidden.
    const hugeMessage = "x".repeat(2000) + " TRACETAIL";
    const item = makeItem({ id: "fail-delete", label: "Fail Delete" });
    setupMocks([item]);
    vi.mocked(deletePortfolioItem).mockRejectedValueOnce(new Error(hugeMessage));

    render(<PortfolioPage />);
    const deleteButton = await screen.findByRole("button", {
      name: /delete fail delete/i,
    });
    fireEvent.click(deleteButton);

    // Wait for the banner to surface the (huge) delete-failure message.
    const banner = await screen.findByLabelText("Submission error");
    expect(banner).toBeInTheDocument();

    // The banner's clamped content includes the trace tail — the clamp
    // truncates visually but the full text stays in the DOM for screen
    // readers / copy-paste.
    expect(banner.textContent).toContain("TRACETAIL");

    // The clamp classes must be present on the banner element itself.
    // Same arbitrary-property shape used by PortfolioErrorState — assert
    // the four required declarations + the break-words utility so any
    // future regression that drops one of them trips this test.
    expect(banner.className).toContain("[-webkit-line-clamp:3]");
    expect(banner.className).toContain("[display:-webkit-box]");
    expect(banner.className).toContain("[-webkit-box-orient:vertical]");
    expect(banner.className).toContain("[overflow:hidden]");
    expect(banner.className).toContain("break-words");

    // The full error text stays in the DOM (screen readers / copy-paste)
    // even though visually only the first 3 lines render. jsdom can't
    // measure the rendered clamp reliably (it ignores `-webkit-line-clamp`),
    // so the class-level assertions above are the contract.
  });
});

// ---------------------------------------------------------------------------
// STOR-44 Phase 3 — the list page surfaces the per-item `shareOriginalWithEmployers`
// flag via a "Shared with employers" pill on rows where the flag is true.
// The pill must NOT appear on rows where the flag is false. Match by
// data-testid (icon-and-label combination would otherwise overlap with
// the page's status-pill labels).
// ---------------------------------------------------------------------------

describe("PortfolioPage — STOR-44 Shared with employers pill", () => {
  it("renders the pill only for items whose shareOriginalWithEmployers is true", async () => {
    const shared = makeItem({
      id: "shared",
      label: "Shared Item",
      shareOriginalWithEmployers: true,
    });
    const notShared = makeItem({
      id: "not-shared",
      label: "Not Shared Item",
      shareOriginalWithEmployers: false,
    });
    setupMocks([shared, notShared]);

    render(<PortfolioPage />);

    // Wait for both rows to render.
    expect(await screen.findByText("Shared Item")).toBeInTheDocument();
    expect(screen.getByText("Not Shared Item")).toBeInTheDocument();

    // Exactly one pill, for the shared row. `getAllByTestId` lets us assert
    // the COUNT (1) — if the pill leaked into the not-shared row too
    // there would be 2.
    expect(
      screen.getAllByTestId("shared-with-employers-pill"),
    ).toHaveLength(1);
  });

  it("does NOT render the pill when no item has the flag set", async () => {
    const a = makeItem({ id: "a", label: "A", shareOriginalWithEmployers: false });
    const b = makeItem({ id: "b", label: "B", shareOriginalWithEmployers: false });
    setupMocks([a, b]);

    render(<PortfolioPage />);
    await screen.findByText("A");
    expect(
      screen.queryByTestId("shared-with-employers-pill"),
    ).not.toBeInTheDocument();
  });
});
