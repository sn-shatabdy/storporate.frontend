import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

// Mocks MUST be hoisted before the page module is imported.
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: vi.fn(),
  useRouter: () => ({ back: backMock }),
}));

vi.mock("@/lib/api/candidateReview", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/candidateReview")>(
      "@/lib/api/candidateReview",
    );
  return {
    ...actual,
    getCandidate: vi.fn(),
    fetchCandidateOriginal: vi.fn(),
  };
});

vi.mock("@/lib/api/outreach", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/outreach")>(
    "@/lib/api/outreach",
  );
  return {
    ...actual,
    addToShortlist: vi.fn(),
    removeFromShortlist: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import { addToShortlist, removeFromShortlist } from "@/lib/api/outreach";
import { useParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import {
  fetchCandidateOriginal,
  getCandidate,
  type CandidateItem,
  type CandidateReview,
} from "@/lib/api/candidateReview";

import CandidatePage from "./page";

const backMock = vi.fn();
const ACCESS_TOKEN = "test-token";
const CANDIDATE_ID = "cand-42";

// --------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------

function makeReview(
  overrides: Partial<CandidateReview> = {},
): CandidateReview {
  return {
    candidateId: CANDIDATE_ID,
    displayName: "Nadia Rahman",
    headline: "Data analyst with Power BI",
    university: "BUET",
    fieldOfStudy: "CSE",
    studyYear: 4,
    items: [],
    ...overrides,
  };
}

function sharedPdfItem(): CandidateItem {
  return {
    portfolioItemId: "pi-pdf",
    label: "Sales dashboard 2025",
    category: "Project",
    shared: true,
    skills: [
      {
        name: "Power BI",
        band: "Strong",
        reason: "Built the entire sales dashboard from raw data.",
      },
      {
        name: "Excel",
        band: "Developing",
        reason: "Used formulas to clean the source sheet.",
      },
    ],
    original: {
      kind: "File",
      available: true,
      fileName: "sales-dashboard.pdf",
      contentType: "application/pdf",
      sizeBytes: Math.round(2.4 * 1024 * 1024),
      host: null,
    },
  };
}

function sharedDocxItem(): CandidateItem {
  return {
    portfolioItemId: "pi-docx",
    label: "Project writeup",
    category: "Document",
    shared: true,
    skills: [
      { name: "Technical writing", band: "Strong", reason: null },
    ],
    original: {
      kind: "File",
      available: true,
      fileName: "project.docx",
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sizeBytes: 100 * 1024,
      host: null,
    },
  };
}

function sharedLinkItem(): CandidateItem {
  return {
    portfolioItemId: "pi-link",
    label: "Open source contribution",
    category: "Project",
    shared: true,
    skills: [
      { name: "Collaboration", band: "Developing", reason: null },
    ],
    original: {
      kind: "Link",
      available: true,
      fileName: null,
      contentType: null,
      sizeBytes: null,
      host: "github.com",
    },
  };
}

function unsharedItem(): CandidateItem {
  return {
    portfolioItemId: "pi-private",
    label: "Internal report",
    category: "Project",
    shared: false,
    skills: [
      { name: "Reporting", band: "Strong", reason: null },
      { name: "Stakeholder mgmt", band: "Developing", reason: null },
    ],
    original: null,
  };
}

function setupSession() {
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN, actorType: "Organization" } as never,
    status: "authenticated",
  } as never);
  vi.mocked(useParams).mockReturnValue({
    candidateId: CANDIDATE_ID,
  } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  setupSession();
  backMock.mockReset();
  // URL APIs (createObjectURL / revokeObjectURL) need to be stubbed
  // so the tests can assert on call counts without crashing (jsdom
  // doesn't implement them by default and Vitest can't spyOn a
  // inherited constructor method directly).
  let createCount = 0;
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
    createCount += 1;
    return `blob:mock-${createCount}`;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {
    /* no-op */
  });
});

afterEach(() => {
  // Make sure no fake-timer state leaks into the next test.
  vi.useRealTimers();
  cleanup();
});

/** Mirror of the search page's helper — same banned-word / banned-mark
 *  set so every drill-down copy surface is pinned. The "Why this rating"
 *  literal is allowed (it's the agreed UI label). */
function expectCopyConstraints(text: string) {
  expect(text.toLowerCase()).not.toContain("evidence");
  expect(text.toLowerCase()).not.toContain("proof");
  expect(text).not.toContain("—");
  expect(text).not.toContain("–");
  expect(text).not.toContain("%");
  // The literal phrase "Why this rating" is allowed — the regex below
  // target the words, not the phrase.
  const withoutLabel = text.replace(/Why this rating/gi, "");
  expect(withoutLabel.toLowerCase()).not.toContain("score");
  expect(withoutLabel.toLowerCase()).not.toContain("rank");
  // "rating" alone would be caught except inside "Why this rating";
  // after the label-replacement above, no standalone rating should
  // remain.
  expect(withoutLabel.toLowerCase()).not.toContain("rating");
  expect(withoutLabel).not.toContain("★");
  expect(withoutLabel).not.toContain("☆");
}

// --------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------

describe("CandidatePage — loading + success render", () => {
  it("renders the loading skeleton, then the candidate header with the full profile line and Self-reported pill", async () => {
    vi.mocked(getCandidate).mockResolvedValue(makeReview({ items: [sharedPdfItem()] }));

    render(<CandidatePage />);

    // Loading first.
    expect(screen.getByText(/Loading the student\./)).toBeInTheDocument();

    // Then loaded: header with name + headline + detail line.
    expect(await screen.findByText("Nadia Rahman")).toBeInTheDocument();
    expect(screen.getByText("Data analyst with Power BI")).toBeInTheDocument();
    expect(screen.getByText("BUET")).toBeInTheDocument();
    expect(screen.getByText("CSE")).toBeInTheDocument();
    expect(screen.getByText("Year 4")).toBeInTheDocument();
    expect(screen.getByText("Self-reported")).toBeInTheDocument();

    // Portfolio heading + item count.
    expect(screen.getByRole("heading", { name: /Portfolio/i })).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("renders no detail row or Self-reported pill when every profile field is null", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({
        headline: null,
        university: null,
        fieldOfStudy: null,
        studyYear: null,
        items: [sharedPdfItem()],
      }),
    );

    render(<CandidatePage />);

    expect(await screen.findByText("Nadia Rahman")).toBeInTheDocument();
    expect(screen.queryByText("BUET")).not.toBeInTheDocument();
    expect(screen.queryByText("CSE")).not.toBeInTheDocument();
    expect(screen.queryByText(/Year /)).not.toBeInTheDocument();
    expect(screen.queryByText("Self-reported")).not.toBeInTheDocument();
  });

  it("renders the count text '3 items' and '1 item' correctly", async () => {
    vi.mocked(getCandidate).mockResolvedValueOnce(
      makeReview({
        items: [sharedPdfItem(), sharedDocxItem(), sharedLinkItem()],
      }),
    );
    const { unmount } = render(<CandidatePage />);
    expect(await screen.findByText("3 items")).toBeInTheDocument();
    unmount();
    cleanup();

    vi.mocked(getCandidate).mockResolvedValueOnce(
      makeReview({ items: [sharedPdfItem()] }),
    );
    render(<CandidatePage />);
    expect(await screen.findByText("1 item")).toBeInTheDocument();
  });
});

describe("CandidatePage — shared vs unshared item rendering", () => {
  it("renders shared-item pills with band colors, the Why this rating text, and Open original", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [sharedPdfItem()] }),
    );

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");

    // Band pills: strong should be #e6f4ea / #1e7b34, developing
    // #fbeee7 / #a4460f.
    const strongPill = screen.getByText(/Power BI · Strong/);
    expect(strongPill.style.backgroundColor).toBe("rgb(230, 244, 234)");
    expect(strongPill.style.color).toBe("rgb(30, 123, 52)");
    const devPill = screen.getByText(/Excel · Developing/);
    expect(devPill.style.backgroundColor).toBe("rgb(251, 238, 231)");
    expect(devPill.style.color).toBe("rgb(164, 70, 15)");

    // "Why this rating" + reason text present (multiple pills, so
    // expect more than one occurrence).
    expect(screen.getAllByText(/Why this rating/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("Built the entire sales dashboard from raw data."),
    ).toBeInTheDocument();

    // Open original button.
    expect(
      screen.getByRole("button", { name: /Open original/i }),
    ).toBeInTheDocument();
  });

  it("renders an unshared item with pills, the lock footer, and no reason text or button", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [unsharedItem()] }),
    );

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");

    // Pills present (just the names + bands).
    expect(screen.getByText(/Reporting · Strong/)).toBeInTheDocument();
    expect(screen.getByText(/Stakeholder mgmt · Developing/)).toBeInTheDocument();
    // Lock footer text.
    expect(
      screen.getByText("The student has not shared the original."),
    ).toBeInTheDocument();
    // No "Open original" / "Open link" / "Why this rating" anywhere.
    expect(screen.queryByText(/Open original/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Why this rating/i)).not.toBeInTheDocument();
  });

  it("renders a shared item whose reason is null with only the pill, no Why block", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [sharedLinkItem()] }),
    );

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");

    // The link item has a skill with reason=null — only the pill,
    // never the "Why this rating" header.
    expect(screen.getByText(/Collaboration · Developing/)).toBeInTheDocument();
    expect(screen.queryByText(/Why this rating/i)).not.toBeInTheDocument();
  });
});

describe("CandidatePage — open original flow", () => {
  it("calls fetchOriginal with token, candidate id and item id, shows 'Opening…' while pending, then renders the dialog with the iframe whose sandbox is empty and title is the file name", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [sharedPdfItem()] }),
    );
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "blob",
      blob: new Blob([new Uint8Array([1, 2, 3])], {
        type: "application/pdf",
      }),
      contentType: "application/pdf",
      fileName: "sales-dashboard.pdf",
      inline: true,
    });

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");

    const openBtn = screen.getByRole("button", { name: /Open original/i });
    fireEvent.click(openBtn);

    await waitFor(() => {
      expect(fetchCandidateOriginal).toHaveBeenCalledTimes(1);
    });
    expect(fetchCandidateOriginal).toHaveBeenCalledWith(
      ACCESS_TOKEN,
      CANDIDATE_ID,
      "pi-pdf",
    );

    // Dialog with iframe and sandbox="".
    const iframe = await screen.findByTitle("sales-dashboard.pdf");
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe.getAttribute("sandbox")).toBe("");
    expect(iframe.getAttribute("title")).toBe("sales-dashboard.pdf");

    // Close button.
    expect(screen.getByRole("button", { name: /^Close$/ })).toBeInTheDocument();
    // Download button.
    expect(screen.getByRole("button", { name: /^Download$/ })).toBeInTheDocument();

    // Close revokes the object URL.
    fireEvent.click(screen.getByRole("button", { name: /^Close$/ }));
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByTitle("sales-dashboard.pdf")).not.toBeInTheDocument();
    });
  });

  it("renders an img element for an image content type", async () => {
    const imageItem: CandidateItem = {
      ...sharedPdfItem(),
      portfolioItemId: "pi-img",
      original: {
        kind: "File",
        available: true,
        fileName: "diagram.png",
        contentType: "image/png",
        sizeBytes: 100 * 1024,
        host: null,
      },
    };
    vi.mocked(getCandidate).mockResolvedValue(makeReview({ items: [imageItem] }));
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "blob",
      blob: new Blob([new Uint8Array([0])], { type: "image/png" }),
      contentType: "image/png",
      fileName: "diagram.png",
      inline: true,
    });

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open original/i }));

    const img = await screen.findByAltText("diagram.png");
    expect(img.tagName).toBe("IMG");
  });

  it("renders a video element with controls for an mp4 content type", async () => {
    const videoItem: CandidateItem = {
      ...sharedPdfItem(),
      portfolioItemId: "pi-video",
      original: {
        kind: "File",
        available: true,
        fileName: "demo.mp4",
        contentType: "video/mp4",
        sizeBytes: 5 * 1024 * 1024,
        host: null,
      },
    };
    vi.mocked(getCandidate).mockResolvedValue(makeReview({ items: [videoItem] }));
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "blob",
      blob: new Blob([new Uint8Array([0])], { type: "video/mp4" }),
      contentType: "video/mp4",
      fileName: "demo.mp4",
      inline: true,
    });

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open original/i }));

    const video = await screen.findByLabelText(
      "demo.mp4",
      { selector: "video" },
    );
    expect(video.tagName).toBe("VIDEO");
    expect(video.hasAttribute("controls")).toBe(true);
  });

  it("triggers a download anchor for a .docx file (inline=false) and shows 'Download started.'", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [sharedDocxItem()] }),
    );
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "blob",
      blob: new Blob([new Uint8Array([0])], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: "project.docx",
      inline: false,
    });

    // Capture the anchor click.
    const clickSpy = vi.fn();
    const originalCreate = document.createElement.bind(document);
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        const el = originalCreate(tag);
        if (tag === "a") {
          (el as HTMLAnchorElement).click = clickSpy;
        }
        return el;
      });

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open original/i }));

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByText("Download started."),
    ).toBeInTheDocument();
    // No iframe / viewer was mounted.
    expect(screen.queryByTitle("project.docx")).not.toBeInTheDocument();

    createSpy.mockRestore();
  });

  it("triggers a download for an inline-safe file over 25 MB instead of previewing", async () => {
    const hugeItem: CandidateItem = {
      ...sharedPdfItem(),
      portfolioItemId: "pi-huge",
      original: {
        kind: "File",
        available: true,
        fileName: "huge.pdf",
        contentType: "application/pdf",
        sizeBytes: 30 * 1024 * 1024,
        host: null,
      },
    };
    vi.mocked(getCandidate).mockResolvedValue(makeReview({ items: [hugeItem] }));
    // The mock blob size doesn't matter — the page reads
    // `result.blob.size`, not the metadata sizeBytes, to enforce
    // the 25 MB cap.
    const hugeBlob = new Blob(
      [new Uint8Array(30 * 1024 * 1024)],
      { type: "application/pdf" },
    );
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "blob",
      blob: hugeBlob,
      contentType: "application/pdf",
      fileName: "huge.pdf",
      inline: true,
    });

    const clickSpy = vi.fn();
    const originalCreate = document.createElement.bind(document);
    const createSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tag: string) => {
        const el = originalCreate(tag);
        if (tag === "a") (el as HTMLAnchorElement).click = clickSpy;
        return el;
      });

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open original/i }));

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Download started.")).toBeInTheDocument();
    expect(screen.queryByTitle("huge.pdf")).not.toBeInTheDocument();

    createSpy.mockRestore();
  });

  it("opens a synchronous blank tab for a Link response, fetches the URL, and redirects the tab", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [sharedLinkItem()] }),
    );
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "link",
      url: "https://github.com/example/project",
    });

    const tab = {
      opener: undefined as unknown,
      location: { href: "" },
      close: vi.fn(),
    };
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockReturnValue(tab as unknown as Window);

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open link/i }));

    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledWith("", "_blank");
    });
    await waitFor(() => {
      expect(tab.location.href).toBe("https://github.com/example/project");
    });
    expect(tab.opener).toBeNull();

    windowOpenSpy.mockRestore();
  });

  it("rejects a javascript: link and shows the unavailable block", async () => {
    const jsItem: CandidateItem = {
      ...sharedLinkItem(),
      portfolioItemId: "pi-js",
      original: {
        kind: "Link",
        available: true,
        fileName: null,
        contentType: null,
        sizeBytes: null,
        host: "evil.example",
      },
    };
    vi.mocked(getCandidate).mockResolvedValue(makeReview({ items: [jsItem] }));
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "link",
      url: "javascript:alert(1)",
    });

    const tab = {
      opener: undefined as unknown,
      location: { href: "" },
      close: vi.fn(),
    };
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockReturnValue(tab as unknown as Window);

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open link/i }));

    await waitFor(() => {
      expect(tab.close).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByText("This original is no longer available."),
    ).toBeInTheDocument();
    expect(tab.location.href).toBe("");

    windowOpenSpy.mockRestore();
  });

  it("shows the 'browser blocked the new tab' alert when window.open returns null and does not navigate", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [sharedLinkItem()] }),
    );
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "link",
      url: "https://github.com/example/project",
    });

    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockReturnValue(null);

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open link/i }));

    await waitFor(() => {
      expect(windowOpenSpy).toHaveBeenCalledWith("", "_blank");
    });
    expect(
      screen.getByText("Your browser blocked the new tab"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Allow pop-ups for this site, then try again."),
    ).toBeInTheDocument();
    // The retryable Try again button is present.
    expect(
      screen.getByRole("button", { name: /Try again/i }),
    ).toBeInTheDocument();
    // And the unavailable-block title must NOT be present.
    expect(
      screen.queryByText("This original is no longer available."),
    ).not.toBeInTheDocument();

    // Clicking Try again must re-fire the request.
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => {
      expect(fetchCandidateOriginal).toHaveBeenCalledTimes(2);
    });

    windowOpenSpy.mockRestore();
  });

  it("closes the opened tab and shows the unavailable block when the resolved URL host does not match the item's host", async () => {
    const mismatchItem: CandidateItem = {
      ...sharedLinkItem(),
      portfolioItemId: "pi-host",
      // Item claims github.com but the backend returns evil.example.
      original: {
        kind: "Link",
        available: true,
        fileName: null,
        contentType: null,
        sizeBytes: null,
        host: "github.com",
      },
    };
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [mismatchItem] }),
    );
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "link",
      url: "https://evil.example/x",
    });

    const tab = {
      opener: undefined as unknown,
      location: { href: "" },
      close: vi.fn(),
    };
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockReturnValue(tab as unknown as Window);

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open link/i }));

    await waitFor(() => {
      expect(tab.close).toHaveBeenCalledTimes(1);
    });
    expect(tab.location.href).toBe("");
    expect(
      screen.getByText("This original is no longer available."),
    ).toBeInTheDocument();

    windowOpenSpy.mockRestore();
  });

  it("matches the resolved URL host case-insensitively against the item's host and navigates", async () => {
    const item: CandidateItem = {
      ...sharedLinkItem(),
      portfolioItemId: "pi-case",
      original: {
        kind: "Link",
        available: true,
        fileName: null,
        contentType: null,
        sizeBytes: null,
        host: "GitHub.COM",
      },
    };
    vi.mocked(getCandidate).mockResolvedValue(makeReview({ items: [item] }));
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "link",
      url: "https://github.com/example/project",
    });

    const tab = {
      opener: undefined as unknown,
      location: { href: "" },
      close: vi.fn(),
    };
    const windowOpenSpy = vi
      .spyOn(window, "open")
      .mockReturnValue(tab as unknown as Window);

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open link/i }));

    await waitFor(() => {
      expect(tab.location.href).toBe("https://github.com/example/project");
    });
    expect(tab.close).not.toHaveBeenCalled();

    windowOpenSpy.mockRestore();
  });

  it("revokes the download object URL after 1500 ms when an inline-safe response is downloaded", async () => {
    // Use fake timers so we can drive the 1500 ms revocation timer
    // deterministically. setInterval is left un-faked so waitFor
    // polling still ticks.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      vi.mocked(getCandidate).mockResolvedValue(
        makeReview({ items: [sharedDocxItem()] }),
      );
      vi.mocked(fetchCandidateOriginal).mockResolvedValue({
        kind: "blob",
        blob: new Blob([new Uint8Array([0])], {
          type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName: "project.docx",
        inline: false,
      });

      const createCallsBefore = (
        URL.createObjectURL as unknown as { mock: { calls: unknown[] } }
      ).mock.calls.length;

      render(<CandidatePage />);
      // Render + findByText happen synchronously when setTimeout is
      // faked (React 19 uses MessageChannel in jsdom); advance a
      // tick so the initial fetch + render commit settles.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      // Use the synchronous query to avoid polling — the heading
      // text is in the initial render output.
      screen.getByText("Nadia Rahman");
      fireEvent.click(screen.getByRole("button", { name: /Open original/i }));

      // Flush the click handler's microtasks + the awaited fetch so
      // the synchronous createObjectURL call has run.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const downloadedUrl = (
        URL.createObjectURL as unknown as {
          mock: { results: { value: string }[] };
        }
      ).mock.results.at(-1)!.value;
      expect(
        (URL.createObjectURL as unknown as { mock: { calls: unknown[] } }).mock
          .calls.length,
      ).toBeGreaterThan(createCallsBefore);

      // Nothing revoked yet.
      expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(downloadedUrl);

      // Advance just short of 1500 ms — the timer must NOT have fired.
      vi.advanceTimersByTime(1499);
      expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(downloadedUrl);

      // Advance past 1500 ms — the timer must fire.
      vi.advanceTimersByTime(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(downloadedUrl);
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the pending download-revocation timer on unmount", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      vi.mocked(getCandidate).mockResolvedValue(
        makeReview({ items: [sharedDocxItem()] }),
      );
      vi.mocked(fetchCandidateOriginal).mockResolvedValue({
        kind: "blob",
        blob: new Blob([new Uint8Array([0])], {
          type:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileName: "project.docx",
        inline: false,
      });

      const revokeCallsBefore = (
        URL.revokeObjectURL as unknown as { mock: { calls: unknown[] } }
      ).mock.calls.length;

      const { unmount } = render(<CandidatePage />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      screen.getByText("Nadia Rahman");
      fireEvent.click(screen.getByRole("button", { name: /Open original/i }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Unmount before the 1500 ms timer fires.
      unmount();
      // Advance well past 1500 ms.
      vi.advanceTimersByTime(5000);

      // The pending revoke timer must have been cancelled; the URL
      // should not have been revoked.
      expect(
        (URL.revokeObjectURL as unknown as { mock: { calls: unknown[] } }).mock
          .calls.length,
      ).toBe(revokeCallsBefore);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("CandidatePage — open error states", () => {
  it("shows the no-retry block for original_unavailable", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [sharedPdfItem()] }),
    );
    vi.mocked(fetchCandidateOriginal).mockRejectedValue(
      new ApiError("original_unavailable", "Removed.", 404),
    );

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open original/i }));

    await waitFor(() => {
      expect(
        screen.getByText("This original is no longer available."),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("The student may have removed it.")).toBeInTheDocument();
    // No retry button.
    expect(
      screen.queryByRole("button", { name: /Try again/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the retry block for an unknown error and Try again re-fires the request", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [sharedPdfItem()] }),
    );
    vi.mocked(fetchCandidateOriginal)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        kind: "blob",
        blob: new Blob([new Uint8Array([0])], { type: "application/pdf" }),
        contentType: "application/pdf",
        fileName: "sales-dashboard.pdf",
        inline: true,
      });

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open original/i }));

    await waitFor(() => {
      expect(screen.getByText("Could not open the original")).toBeInTheDocument();
    });
    const retryBtn = await screen.findByRole("button", { name: /Try again/i });
    fireEvent.click(retryBtn);
    await waitFor(() => {
      expect(fetchCandidateOriginal).toHaveBeenCalledTimes(2);
    });
    // And the second attempt succeeded → viewer mounted.
    expect(await screen.findByTitle("sales-dashboard.pdf")).toBeInTheDocument();
  });
});

describe("CandidatePage — load error states", () => {
  it("shows the not-found card for candidate_not_found with a Back link", async () => {
    vi.mocked(getCandidate).mockRejectedValue(
      new ApiError("candidate_not_found", "Not found.", 404),
    );

    render(<CandidatePage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /no longer available/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText("They have turned off employer visibility."),
    ).toBeInTheDocument();
    // Multiple "Back to results" links (the top-of-page back button +
    // the centered link inside the not-found card). Assert at least
    // one points to /employer/search via the in-card link.
    const backLinks = screen.getAllByRole("link", { name: /Back to results/i });
    expect(backLinks.length).toBeGreaterThanOrEqual(1);
    expect(backLinks.some((el) => el.getAttribute("href") === "/employer/search")).toBe(true);
  });

  it("shows the retry state for other load errors and Try again re-fetches", async () => {
    vi.mocked(getCandidate)
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(makeReview({ items: [sharedPdfItem()] }));

    render(<CandidatePage />);
    await waitFor(() => {
      expect(screen.getByText("Could not load this student")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Check your connection and try again."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    await waitFor(() => {
      expect(getCandidate).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText("Nadia Rahman")).toBeInTheDocument();
  });
});

describe("CandidatePage — viewer lifecycle", () => {
  it("opening a second item's original closes the first viewer", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [sharedPdfItem(), sharedLinkItem()] }),
    );
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "blob",
      blob: new Blob([new Uint8Array([0])], { type: "application/pdf" }),
      contentType: "application/pdf",
      fileName: "sales-dashboard.pdf",
      inline: true,
    });

    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");

    // Open the PDF first.
    fireEvent.click(screen.getByRole("button", { name: /Open original/i }));
    await waitFor(() => {
      expect(screen.getByTitle("sales-dashboard.pdf")).toBeInTheDocument();
    });
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    // Switch fetchOriginal to return a link response and click
    // "Open link" — the page should close the PDF viewer first.
    vi.mocked(fetchCandidateOriginal).mockResolvedValueOnce({
      kind: "link",
      url: "https://example.com",
    });
    const tab = { opener: undefined, location: { href: "" }, close: vi.fn() };
    const openSpy = vi
      .spyOn(window, "open")
      .mockReturnValue(tab as unknown as Window);

    // Snapshot the createObjectURL call count BEFORE clicking so we
    // can detect the second create (for any new download anchor)
    // independently of the original viewer.
    const createCallsBefore = (URL.createObjectURL as unknown as {
      mock: { calls: unknown[] };
    }).mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: /Open link/i }));

    // Wait for either: revoke called OR the link fetch resolved (a
    // new open tab was created). Either signal means the page
    // processed the second click.
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalled();
    });
    // After processing the second click, the PDF viewer should be
    // closed (its URL revoked) and the new createObjectURL calls
    // should match the number of anchor downloads triggered by the
    // link response — zero (links don't download).
    expect(
      (URL.createObjectURL as unknown as { mock: { calls: unknown[] } }).mock
        .calls.length,
    ).toBe(createCallsBefore);
    // Revoke should have been called at least once (when closing
    // the PDF viewer; the link flow does NOT trigger a download).
    expect(URL.revokeObjectURL).toHaveBeenCalled();

    openSpy.mockRestore();
  });

  it("revokes the active viewer object URL on unmount", async () => {
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({ items: [sharedPdfItem()] }),
    );
    vi.mocked(fetchCandidateOriginal).mockResolvedValue({
      kind: "blob",
      blob: new Blob([new Uint8Array([0])], { type: "application/pdf" }),
      contentType: "application/pdf",
      fileName: "sales-dashboard.pdf",
      inline: true,
    });

    const { unmount } = render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");
    fireEvent.click(screen.getByRole("button", { name: /Open original/i }));
    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});

describe("CandidatePage — copy hygiene", () => {
  it("rendered text in every state contains no banned words, dashes, or score markers", async () => {
    // Success path.
    vi.mocked(getCandidate).mockResolvedValue(
      makeReview({
        items: [sharedPdfItem(), sharedDocxItem(), sharedLinkItem(), unsharedItem()],
      }),
    );
    render(<CandidatePage />);
    await screen.findByText("Nadia Rahman");

    expectCopyConstraints(document.body.textContent ?? "");
  });

  it("not-found and load-error copy also passes the constraint", async () => {
    // Network error path first.
    vi.mocked(getCandidate)
      .mockRejectedValueOnce(new Error("network"));
    const errRender = render(<CandidatePage />);
    await waitFor(() => {
      expect(screen.getByText("Could not load this student")).toBeInTheDocument();
    });
    expectCopyConstraints(document.body.textContent ?? "");
    errRender.unmount();
    cleanup();

    // Not-found path.
    vi.mocked(useSession).mockReturnValue({
      data: { accessToken: ACCESS_TOKEN, actorType: "Organization" } as never,
      status: "authenticated",
    } as never);
    vi.mocked(useParams).mockReturnValue({
      candidateId: CANDIDATE_ID,
    } as never);
    vi.mocked(getCandidate)
      .mockReset()
      .mockRejectedValueOnce(
        new ApiError("candidate_not_found", "missing", 404),
      );
    render(<CandidatePage />);
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /no longer available/i }),
      ).toBeInTheDocument();
    });
    expectCopyConstraints(document.body.textContent ?? "");
  });
});

describe("CandidatePage: shortlist and invite (STOR-68)", () => {
  it("shows Save to shortlist and Invite in the header and toggles Saved", async () => {
    vi.mocked(getCandidate).mockResolvedValue(makeReview());
    vi.mocked(addToShortlist).mockResolvedValue({
      candidateId: CANDIDATE_ID,
      displayName: "Nadia Rahman",
      headline: null,
      university: null,
      fieldOfStudy: null,
      studyYear: null,
      available: true,
      savedAt: "2026-09-20T10:00:00Z",
      conversation: null,
    });
    vi.mocked(removeFromShortlist).mockResolvedValue(undefined);
    render(<CandidatePage />);

    const save = await screen.findByRole("button", { name: "Save to shortlist" });
    expect(screen.getByRole("button", { name: "Invite" })).toBeInTheDocument();
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByText("Saved")).toBeInTheDocument());
    expect(addToShortlist).toHaveBeenCalledWith(ACCESS_TOKEN, CANDIDATE_ID);

    fireEvent.click(screen.getByRole("button", { name: "Remove from shortlist" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save to shortlist" }),
      ).toBeInTheDocument(),
    );
    expect(removeFromShortlist).toHaveBeenCalledWith(ACCESS_TOKEN, CANDIDATE_ID);
    expectCopyConstraints(document.body.textContent ?? "");
  });
});
