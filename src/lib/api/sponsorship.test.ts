import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";

const ORIGINAL_ENV = { ...process.env };
const API_BASE = "https://example.test";

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

async function loadClient() {
  process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE;
  return import("./sponsorship");
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function stubFetch(response: Response) {
  const fn = vi.fn().mockImplementation(async () => response.clone());
  vi.stubGlobal("fetch", fn);
  return fn;
}

const REQUEST = {
  name: "Campus hiring",
  companyName: "Acme Ltd",
  objectives: ["Recruiting"],
  audience: { fieldsOfStudy: ["Computer Science"], years: [3, 4], cities: [], universities: [] },
  eventKinds: ["Hackathon"],
  budget: { min: 50000, max: 200000, visibleToClubs: false },
  notes: null,
};

describe("company goal set endpoints", () => {
  it("listGoalSets GETs the list with the bearer token", async () => {
    const { listGoalSets } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    const result = await listGoalSets("tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/goals`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(result).toEqual({ items: [] });
  });

  it("getGoalSet GETs one set by encoded id", async () => {
    const { getGoalSet } = await loadClient();
    const fetchMock = stubFetch(json({ id: "a/b" }));
    await getGoalSet("tok", "a/b");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/sponsorship/goals/a%2Fb`);
  });

  it("createGoalSet POSTs the body", async () => {
    const { createGoalSet } = await loadClient();
    const fetchMock = stubFetch(json({ id: "g1" }, { status: 201 }));
    await createGoalSet("tok", REQUEST);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/goals`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(REQUEST);
  });

  it("updateGoalSet PUTs the body to the id", async () => {
    const { updateGoalSet } = await loadClient();
    const fetchMock = stubFetch(json({ id: "g1" }));
    await updateGoalSet("tok", "g1", REQUEST);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/goals/g1`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(REQUEST);
  });

  it("setGoalSetStatus POSTs the status", async () => {
    const { setGoalSetStatus } = await loadClient();
    const fetchMock = stubFetch(json({ id: "g1", status: "Paused" }));
    await setGoalSetStatus("tok", "g1", "Paused");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/goals/g1/status`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ status: "Paused" });
  });

  it("deleteGoalSet DELETEs and accepts an empty 204", async () => {
    const { deleteGoalSet } = await loadClient();
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(deleteGoalSet("tok", "g1")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/goals/g1`);
    expect(init.method).toBe("DELETE");
  });

  it("maps sponsorship_goal_not_found to an ApiError", async () => {
    const { getGoalSet } = await loadClient();
    stubFetch(
      json({ errorCode: "sponsorship_goal_not_found", message: "none" }, { status: 404 }),
    );
    await expect(getGoalSet("tok", "x")).rejects.toMatchObject({
      errorCode: "sponsorship_goal_not_found",
      status: 404,
    });
    await expect(getGoalSet("tok", "x")).rejects.toBeInstanceOf(ApiError);
  });

  it("createGoalSet surfaces the audience rule with its message", async () => {
    const { createGoalSet } = await loadClient();
    stubFetch(
      json(
        { errorCode: "sponsorship_goal_audience_required", message: "Add an audience." },
        { status: 400 },
      ),
    );
    await expect(createGoalSet("tok", REQUEST)).rejects.toMatchObject({
      errorCode: "sponsorship_goal_audience_required",
      message: "Add an audience.",
    });
  });
});

describe("club endpoints", () => {
  it("listCompanyGoals leaves empty filters out", async () => {
    const { listCompanyGoals } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listCompanyGoals("tok");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/sponsorship/companies`);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });

  it("listCompanyGoals encodes and trims the filters", async () => {
    const { listCompanyGoals } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listCompanyGoals("tok", {
      q: " acme corp ",
      objective: "Brand awareness",
      eventKind: "  ",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE}/api/sponsorship/companies?objective=Brand+awareness&q=acme+corp`,
    );
  });

  it("getCompanyGoal GETs one set by encoded id", async () => {
    const { getCompanyGoal } = await loadClient();
    const fetchMock = stubFetch(json({ id: "a/b" }));
    await getCompanyGoal("tok", "a/b");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/sponsorship/companies/a%2Fb`);
  });
});

describe("fixed lists", () => {
  it("exposes the objectives, event kinds and years", async () => {
    const { OBJECTIVES, EVENT_KINDS, STUDY_YEARS } = await loadClient();
    expect(OBJECTIVES).toHaveLength(6);
    expect(OBJECTIVES[0]).toBe("Brand awareness");
    expect(EVENT_KINDS).toHaveLength(8);
    expect(EVENT_KINDS).toContain("Career fair");
    expect(STUDY_YEARS).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
