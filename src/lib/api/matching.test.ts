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
  return import("./matching");
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

describe("listClubMatches", () => {
  it("GETs the goal set matches with the bearer token and no q when empty", async () => {
    const { listClubMatches } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    const result = await listClubMatches("tok", "g1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/goals/g1/club-matches`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(result).toEqual({ items: [] });
  });

  it("encodes the id and the search words", async () => {
    const { listClubMatches } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listClubMatches("tok", "a/b", "  hackathon & year 2  ");
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE}/api/sponsorship/goals/a%2Fb/club-matches?q=hackathon+%26+year+2`,
    );
  });

  it("leaves a blank q out of the URL", async () => {
    const { listClubMatches } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listClubMatches("tok", "g1", "   ");
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE}/api/sponsorship/goals/g1/club-matches`,
    );
  });

  it("maps a missing goal set and an invalid query to ApiError", async () => {
    const { listClubMatches } = await loadClient();
    stubFetch(json({ errorCode: "sponsorship_goal_not_found", message: "x" }, { status: 404 }));
    await expect(listClubMatches("tok", "x")).rejects.toMatchObject({
      errorCode: "sponsorship_goal_not_found",
      status: 404,
    });
    stubFetch(
      json({ errorCode: "sponsorship_match_query_invalid", message: "x" }, { status: 400 }),
    );
    await expect(listClubMatches("tok", "x", "q")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("listCompanyMatches", () => {
  it("GETs the company matches, with q when given", async () => {
    const { listCompanyMatches } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listCompanyMatches("tok");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/clubs/profile/company-matches`);
    await listCompanyMatches("tok", "need sponsor for a career fair");
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${API_BASE}/api/clubs/profile/company-matches?q=need+sponsor+for+a+career+fair`,
    );
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer tok");
  });

  it("maps 404 and 409 profile errors to ApiError", async () => {
    const { listCompanyMatches } = await loadClient();
    stubFetch(json({ errorCode: "club_profile_not_found", message: "x" }, { status: 404 }));
    await expect(listCompanyMatches("tok")).rejects.toMatchObject({
      errorCode: "club_profile_not_found",
      status: 404,
    });
    stubFetch(json({ errorCode: "club_profile_not_published", message: "x" }, { status: 409 }));
    await expect(listCompanyMatches("tok")).rejects.toMatchObject({
      errorCode: "club_profile_not_published",
      status: 409,
    });
  });
});
