import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

// Mocks MUST be hoisted before the page module is imported.
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/api/talentSearch", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api/talentSearch")>(
      "@/lib/api/talentSearch",
    );
  return {
    ...actual,
    createTalentSearch: vi.fn(),
    getTalentSearch: vi.fn(),
  };
});

import { useSession } from "next-auth/react";
import { ApiError } from "@/lib/api/errors";
import {
  createTalentSearch,
  getTalentSearch,
  type TalentSearch,
  type TalentSearchResultItem,
} from "@/lib/api/talentSearch";

import EmployerSearchPage from "./page";

const ACCESS_TOKEN = "test-token";

const BASE_RESULT: TalentSearchResultItem = {
  candidateId: "cand-1",
  displayName: "Nadia Rahman",
  headline: "Data analyst with Power BI",
  university: "BUET",
  fieldOfStudy: "CSE",
  studyYear: 3,
  matchedSkills: [
    { name: "Power BI", band: "Strong" },
    { name: "Excel", band: "Developing" },
  ],
  reason: "Has built Power BI dashboards from messy sales data.",
  citedItems: [
    {
      portfolioItemId: "pi-1",
      label: "Sales dashboard 2025",
      category: "Project",
      skillName: "Power BI",
      band: "Strong",
    },
  ],
};

function completedWith(results: TalentSearchResultItem[]): TalentSearch {
  return {
    id: "search-123",
    status: "Completed",
    query: "data dashboards",
    createdAt: "2026-09-21T00:00:00Z",
    completedAt: "2026-09-21T00:00:05Z",
    results,
    errorCode: null,
  };
}

function pendingSearch(): TalentSearch {
  return {
    id: "search-123",
    status: "Pending",
    query: "data dashboards",
    createdAt: "2026-09-21T00:00:00Z",
    completedAt: null,
    results: null,
    errorCode: null,
  };
}

function setupSession() {
  vi.mocked(useSession).mockReturnValue({
    data: { accessToken: ACCESS_TOKEN } as never,
    status: "authenticated",
  } as never);
}

beforeEach(() => {
  vi.resetAllMocks();
  setupSession();
});

afterEach(() => {
  cleanup();
});

/** Whole-page check that the asserted copy contains none of the banned
 *  words ("evidence", "proof"), no em / en dashes, and no banned
 *  score/percent/rank/rating/star characters. */
function expectCopyConstraints(text: string) {
  expect(text.toLowerCase()).not.toContain("evidence");
  expect(text.toLowerCase()).not.toContain("proof");
  expect(text).not.toContain("—");
  expect(text).not.toContain("–");
  expect(text).not.toContain("%");
  expect(text.toLowerCase()).not.toContain("score");
  expect(text.toLowerCase()).not.toContain("rank");
  expect(text.toLowerCase()).not.toContain("rating");
  expect(text).not.toContain("★");
  expect(text).not.toContain("☆");
}

/** Drive the polling loop by one interval and let the in-flight GET
 *  resolve. Keeps fake-timer tests deterministic without falling
 *  back to `waitFor`'s real-time polling (which would conflict with
 *  vi.useFakeTimers()). */
async function advanceOnePoll() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
}

describe("EmployerSearchPage — idle state", () => {
  it("shows the label, placeholder, disabled Search, idle counter, and the three chips", () => {
    render(<EmployerSearchPage />);

    expect(screen.getByLabelText(/Who are you looking for/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Someone who can build data dashboards/i),
    ).toBeInTheDocument();

    const searchBtn = screen.getByRole("button", { name: /^Search$/ });
    expect(searchBtn).toBeDisabled();
    expect(
      screen.getByText(/0 of 1000 characters\. A search can take up to a minute\./),
    ).toBeInTheDocument();

    // Three example chips visible.
    expect(
      screen.getByRole("button", { name: /Data dashboards in Power BI/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Junior backend developer who knows \.NET/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Designer with brand identity work/i }),
    ).toBeInTheDocument();
  });

  it("clicking a chip fills the textarea and enables Search (without auto-submitting)", () => {
    vi.mocked(createTalentSearch).mockResolvedValue({ searchId: "search-x" });
    render(<EmployerSearchPage />);

    fireEvent.click(
      screen.getByRole("button", { name: /Data dashboards in Power BI/i }),
    );

    const textarea = screen.getByLabelText(/Who are you looking for/i);
    expect(textarea).toHaveValue("Data dashboards in Power BI");
    const searchBtn = screen.getByRole("button", { name: /^Search$/ });
    expect(searchBtn).not.toBeDisabled();
    // No auto-submit.
    expect(createTalentSearch).not.toHaveBeenCalled();
  });
});

describe("EmployerSearchPage — query validation", () => {
  it("keeps Search disabled and shows 'Write at least 10 characters.' for a short query, never calling POST", () => {
    render(<EmployerSearchPage />);

    const textarea = screen.getByLabelText(/Who are you looking for/i);
    fireEvent.change(textarea, { target: { value: "abcde" } });

    expect(
      screen.getByText("Write at least 10 characters."),
    ).toBeInTheDocument();
    const searchBtn = screen.getByRole("button", { name: /^Search$/ });
    expect(searchBtn).toBeDisabled();
    expect(createTalentSearch).not.toHaveBeenCalled();
  });
});

describe("EmployerSearchPage — submit + polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("submits the trimmed query once, shows the searching state, polls every 4s, then renders results", async () => {
    // POST returns the id; the immediate-tick GET returns Pending.
    // The next two scheduled ticks also return Pending; the third
    // resolves Completed with two results.
    vi.mocked(createTalentSearch).mockResolvedValue({ searchId: "search-123" });
    vi.mocked(getTalentSearch)
      .mockResolvedValueOnce(pendingSearch()) // immediate tick
      .mockResolvedValueOnce(pendingSearch()) // first interval
      .mockResolvedValueOnce(pendingSearch()) // second interval
      .mockResolvedValueOnce(
        completedWith([
          BASE_RESULT,
          { ...BASE_RESULT, candidateId: "cand-2", displayName: "Sabbir Ahmed" },
        ]),
      ); // third interval

    render(<EmployerSearchPage />);

    const textarea = screen.getByLabelText(/Who are you looking for/i);
    fireEvent.change(textarea, {
      target: { value: "  someone who can build data dashboards  " },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    });

    // POST fired once with the trimmed query.
    expect(createTalentSearch).toHaveBeenCalledTimes(1);
    expect(createTalentSearch).toHaveBeenCalledWith(ACCESS_TOKEN, {
      query: "someone who can build data dashboards",
    });

    // The searching state is visible.
    expect(
      screen.getByText(/Searching student portfolios\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/This takes about a minute\./)).toBeInTheDocument();

    // Drive three ticks (one immediate + two intervals), each returning
    // Pending; the fourth returns Completed.
    await advanceOnePoll(); // 1st interval → Pending
    await advanceOnePoll(); // 2nd interval → Pending
    await advanceOnePoll(); // 3rd interval → Completed

    // After the resolved tick, results render.
    expect(screen.getByText(/Best matches/i)).toBeInTheDocument();
    expect(screen.getByText(/2 students, best match first/i)).toBeInTheDocument();
    expect(screen.getByText("Nadia Rahman")).toBeInTheDocument();
    expect(screen.getByText("Sabbir Ahmed")).toBeInTheDocument();

    // 4 GETs happened — the immediate and the three scheduled ticks.
    expect(vi.mocked(getTalentSearch)).toHaveBeenCalledTimes(4);
  });

  it("polling stops on unmount (no further GET after the component is gone)", async () => {
    vi.mocked(createTalentSearch).mockResolvedValue({ searchId: "search-123" });
    vi.mocked(getTalentSearch).mockResolvedValue(pendingSearch());

    const { unmount } = render(<EmployerSearchPage />);
    const textarea = screen.getByLabelText(/Who are you looking for/i);
    fireEvent.change(textarea, { target: { value: "valid long query for search" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    });

    // Two scheduled ticks while mounted.
    await advanceOnePoll();
    await advanceOnePoll();
    const callsBeforeUnmount = vi.mocked(getTalentSearch).mock.calls.length;
    unmount();
    // Several intervals after unmount — none should fire GETs.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(vi.mocked(getTalentSearch).mock.calls.length).toBe(callsBeforeUnmount);
  });

  it("a new search cancels the previous polling loop", async () => {
    // First POST returns search-A; second POST returns search-B.
    vi.mocked(createTalentSearch)
      .mockResolvedValueOnce({ searchId: "search-A" })
      .mockResolvedValueOnce({ searchId: "search-B" });
    // Track which ids we've actually GET'd against so we can assert
    // that search-A stops being polled once search-B is submitted.
    const getIdsSeen: string[] = [];
    vi.mocked(getTalentSearch).mockImplementation(async (_token, id) => {
      getIdsSeen.push(id);
      // Resolve search-A to Completed after the first GET so the
      // page leaves the `busy` state and the Search button becomes
      // clickable again for the second submit. Everything else stays
      // Pending.
      if (id === "search-A") return completedWith([BASE_RESULT]);
      return pendingSearch();
    });

    render(<EmployerSearchPage />);
    const textarea = screen.getByLabelText(/Who are you looking for/i);

    fireEvent.change(textarea, { target: { value: "another long enough query text" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    });
    // Drive one tick — search-A's immediate-tick GET resolves
    // Completed, so the page transitions to the results state and the
    // Search button is re-enabled.
    await advanceOnePoll();

    // Snapshot the GET count before the second submit. Only search-A
    // has been GET'd so far.
    const callsBefore = getIdsSeen.length;
    expect(getIdsSeen.filter((id) => id === "search-A").length).toBeGreaterThanOrEqual(1);
    expect(getIdsSeen.filter((id) => id === "search-B").length).toBe(0);

    // Submit a second query — POST returns search-B, which kicks off
    // a fresh polling loop. The previous loop is already cleaned up
    // (status moved out of `busy`), so no further GETs should target
    // search-A.
    fireEvent.change(textarea, {
      target: { value: "yet another long enough query text" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    });
    // Drive a couple of intervals for the new loop.
    await advanceOnePoll();
    await advanceOnePoll();

    // Both POSTs fired.
    expect(createTalentSearch).toHaveBeenCalledTimes(2);
    // No GETs after the second submit targeted search-A.
    const aCallsAfter = getIdsSeen.filter((id) => id === "search-A").length;
    const bCallsAfter = getIdsSeen.filter((id) => id === "search-B").length;
    expect(aCallsAfter).toBe(callsBefore);
    // search-B is the only new target.
    expect(bCallsAfter).toBeGreaterThanOrEqual(1);
  });
});

describe("EmployerSearchPage — completed results", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the name, headline, detail line, Self-reported pill, reason, skill pills with the right colors, and 'From their portfolio'", async () => {
    vi.mocked(createTalentSearch).mockResolvedValue({ searchId: "search-123" });
    vi.mocked(getTalentSearch)
      .mockResolvedValueOnce(pendingSearch())
      .mockResolvedValueOnce(completedWith([BASE_RESULT]));

    render(<EmployerSearchPage />);
    const textarea = screen.getByLabelText(/Who are you looking for/i);
    fireEvent.change(textarea, {
      target: { value: "valid long enough query text" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    });

    await advanceOnePoll();

    // Name + headline.
    expect(screen.getByText("Nadia Rahman")).toBeInTheDocument();
    expect(screen.getByText("Data analyst with Power BI")).toBeInTheDocument();

    // Detail line: BUET · CSE · Year 3 + Self-reported pill.
    const card = screen.getByText("Nadia Rahman").closest("li") as HTMLElement;
    expect(card.textContent).toContain("BUET");
    expect(card.textContent).toContain("CSE");
    expect(card.textContent).toContain("Year 3");
    expect(card.textContent).toContain("Self-reported");

    // Reason.
    expect(card.textContent).toContain(
      "Has built Power BI dashboards from messy sales data.",
    );

    // Skill pills: Strong uses success tokens; Developing uses warning
    // tokens. The card has TWO Power BI · Strong pills (one in the
    // matched-skills row, one in the cited-item list), so grab them all
    // and assert the classes are consistent.
    const strongPills = screen.getAllByText(/Power BI · Strong/);
    expect(strongPills.length).toBeGreaterThanOrEqual(1);
    for (const pill of strongPills) {
      expect(pill).toHaveClass("bg-success-soft", "text-success");
    }
    const developingPills = screen.getAllByText(/Excel · Developing/);
    expect(developingPills.length).toBe(1);
    expect(developingPills[0]).toHaveClass("bg-warning-soft", "text-warning");

    // Cited item.
    expect(screen.getByText(/From their portfolio/i)).toBeInTheDocument();
    expect(screen.getByText("Sales dashboard 2025")).toBeInTheDocument();
    expect(screen.getByText("Project")).toBeInTheDocument();
  });

  it("hides the detail row and Self-reported pill when every profile field is null", async () => {
    vi.mocked(createTalentSearch).mockResolvedValue({ searchId: "search-123" });
    vi.mocked(getTalentSearch)
      .mockResolvedValueOnce(pendingSearch())
      .mockResolvedValueOnce(
        completedWith([
          {
            ...BASE_RESULT,
            displayName: "Private Student",
            headline: null,
            university: null,
            fieldOfStudy: null,
            studyYear: null,
          },
        ]),
      );

    render(<EmployerSearchPage />);
    const textarea = screen.getByLabelText(/Who are you looking for/i);
    fireEvent.change(textarea, {
      target: { value: "valid long enough query text" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    });
    await advanceOnePoll();

    const card = screen.getByText("Private Student").closest("li") as HTMLElement;
    expect(card.textContent).not.toContain("BUET");
    expect(card.textContent).not.toContain("CSE");
    expect(card.textContent).not.toContain("Year ");
    expect(card.textContent).not.toContain("Self-reported");
  });

  it("Completed with [] shows the 'No matching students' card", async () => {
    vi.mocked(createTalentSearch).mockResolvedValue({ searchId: "search-123" });
    vi.mocked(getTalentSearch)
      .mockResolvedValueOnce(pendingSearch())
      .mockResolvedValueOnce(completedWith([]));

    render(<EmployerSearchPage />);
    const textarea = screen.getByLabelText(/Who are you looking for/i);
    fireEvent.change(textarea, {
      target: { value: "valid long enough query text" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    });
    await advanceOnePoll();

    // The visible heading ("No matching students") and the sr-only
    // announcement ("No matching students.") both contain this text —
    // pick the heading specifically to avoid the duplicate match.
    expect(
      screen.getByRole("heading", { name: /No matching students/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Try naming the skills you need, or describe the role in different words\./i,
      ),
    ).toBeInTheDocument();
  });
});

describe("EmployerSearchPage — failed state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the failed alert when status becomes Failed; 'Try again' resubmits the same query", async () => {
    vi.mocked(createTalentSearch)
      .mockResolvedValueOnce({ searchId: "search-123" })
      .mockResolvedValueOnce({ searchId: "search-456" });
    vi.mocked(getTalentSearch)
      .mockResolvedValueOnce(pendingSearch())
      .mockResolvedValueOnce({
        id: "search-123",
        status: "Failed",
        query: "x",
        createdAt: "2026-09-21T00:00:00Z",
        completedAt: "2026-09-21T00:00:01Z",
        results: null,
        errorCode: "llm_provider_error",
      });

    render(<EmployerSearchPage />);
    const textarea = screen.getByLabelText(/Who are you looking for/i);
    fireEvent.change(textarea, {
      target: { value: "valid long enough query text" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    });
    await advanceOnePoll();

    expect(
      screen.getByText(/The search could not finish/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Try again.")).toBeInTheDocument();

    // The query is still in the box.
    expect(textarea).toHaveValue("valid long enough query text");

    // Click Try again.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Try again/i }));
    });
    expect(createTalentSearch).toHaveBeenCalledTimes(2);
    expect(createTalentSearch).toHaveBeenLastCalledWith(ACCESS_TOKEN, {
      query: "valid long enough query text",
    });
  });

  it("POST 409 talent_search_busy shows the busy notice and keeps the query", async () => {
    vi.mocked(createTalentSearch).mockRejectedValueOnce(
      new ApiError(
        "talent_search_busy",
        "A search is already running.",
        409,
      ),
    );

    render(<EmployerSearchPage />);
    const textarea = screen.getByLabelText(/Who are you looking for/i);
    fireEvent.change(textarea, {
      target: { value: "valid long enough query text" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));

    await act(async () => {
      // Let the rejected promise resolve so React flushes the busy
      // state update.
      await Promise.resolve();
    });

    expect(
      screen.getByText(/A search is already running\. Wait for it to finish\./i),
    ).toBeInTheDocument();
    expect(textarea).toHaveValue("valid long enough query text");
    // The Search button stays enabled for retry.
    expect(
      screen.getByRole("button", { name: /^Search$/ }),
    ).not.toBeDisabled();
  });

  it("two consecutive GET network errors transition to the failed state", async () => {
    vi.mocked(createTalentSearch).mockResolvedValue({ searchId: "search-123" });
    vi.mocked(getTalentSearch).mockRejectedValue(new Error("network down"));

    render(<EmployerSearchPage />);
    const textarea = screen.getByLabelText(/Who are you looking for/i);
    fireEvent.change(textarea, {
      target: { value: "valid long enough query text" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    });
    // Two ticks → 2 errors → failed state.
    await advanceOnePoll();
    await advanceOnePoll();

    expect(
      screen.getByText(/The search could not finish/i),
    ).toBeInTheDocument();
  });
});

describe("EmployerSearchPage — no-results-only elements do not render while searching", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render the results list or no-results card during the searching state", async () => {
    vi.mocked(createTalentSearch).mockResolvedValue({ searchId: "search-123" });
    vi.mocked(getTalentSearch).mockResolvedValue(pendingSearch());

    render(<EmployerSearchPage />);
    const textarea = screen.getByLabelText(/Who are you looking for/i);
    fireEvent.change(textarea, {
      target: { value: "valid long enough query text" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
    });

    // Searching visible.
    expect(
      screen.getByText(/Searching student portfolios\./),
    ).toBeInTheDocument();
    // Results / no-results / failed NOT visible.
    expect(screen.queryByText(/Best matches/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No matching students/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/The search could not finish/i),
    ).not.toBeInTheDocument();
  });
});

describe("EmployerSearchPage — copy hygiene", () => {
  it("rendered text in every state contains no banned words, dashes, or score markers", async () => {
    // Idle state (no fake timers needed).
    const idle = render(<EmployerSearchPage />);
    expectCopyConstraints(document.body.textContent ?? "");
    idle.unmount();
    document.body.innerHTML = "";

    vi.useFakeTimers();
    try {
      // Searching state.
      vi.mocked(createTalentSearch).mockResolvedValue({ searchId: "search-123" });
      vi.mocked(getTalentSearch).mockResolvedValue(pendingSearch());
      const searching = render(<EmployerSearchPage />);
      fireEvent.change(screen.getByLabelText(/Who are you looking for/i), {
        target: { value: "valid long enough query text" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
      });
      await advanceOnePoll();
      expectCopyConstraints(document.body.textContent ?? "");
      searching.unmount();
      document.body.innerHTML = "";

      // Results state.
      vi.mocked(getTalentSearch).mockReset();
      vi.mocked(getTalentSearch)
        .mockResolvedValueOnce(pendingSearch())
        .mockResolvedValueOnce(completedWith([BASE_RESULT]));
      const resultsRender = render(<EmployerSearchPage />);
      fireEvent.change(screen.getByLabelText(/Who are you looking for/i), {
        target: { value: "another valid long query text" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
      });
      await advanceOnePoll();
      expect(
        screen.getByText(/Best matches/i),
      ).toBeInTheDocument();
      expectCopyConstraints(document.body.textContent ?? "");
      resultsRender.unmount();
      document.body.innerHTML = "";

      // No-results state.
      vi.mocked(getTalentSearch).mockReset();
      vi.mocked(getTalentSearch)
        .mockResolvedValueOnce(pendingSearch())
        .mockResolvedValueOnce(completedWith([]));
      const noResultsRender = render(<EmployerSearchPage />);
      fireEvent.change(screen.getByLabelText(/Who are you looking for/i), {
        target: { value: "yet another valid long query" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
      });
      await advanceOnePoll();
      expect(
        screen.getByRole("heading", { name: /No matching students/i }),
      ).toBeInTheDocument();
      expectCopyConstraints(document.body.textContent ?? "");
      noResultsRender.unmount();
      document.body.innerHTML = "";

      // Failed state.
      vi.mocked(getTalentSearch).mockReset();
      vi.mocked(getTalentSearch)
        .mockResolvedValueOnce(pendingSearch())
        .mockResolvedValueOnce({
          id: "search-x",
          status: "Failed",
          query: "x",
          createdAt: "2026-09-21T00:00:00Z",
          completedAt: "2026-09-21T00:00:01Z",
          results: null,
          errorCode: "llm_provider_error",
        });
      render(<EmployerSearchPage />);
      fireEvent.change(screen.getByLabelText(/Who are you looking for/i), {
        target: { value: "still another valid long query" },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
      });
      await advanceOnePoll();
      expect(
        screen.getByText(/The search could not finish/i),
      ).toBeInTheDocument();
      expectCopyConstraints(document.body.textContent ?? "");
    } finally {
      vi.useRealTimers();
    }
  });
});
