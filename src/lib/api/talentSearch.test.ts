import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";

/**
 * Tests for the talent-search API client (STOR-43 Phase 4). Pins the HTTP
 * contract against the live backend implementation:
 *   - createTalentSearch issues a POST to the right path with the JSON body
 *     and bearer token, and returns the { searchId } from 202.
 *   - getTalentSearch issues a GET to the right path (with the id
 *     URI-encoded) and bearer token, and returns the full search payload.
 *   - Non-2xx responses bubble up as a typed `ApiError` carrying the
 *     backend's `errorCode` and HTTP status, so the page can switch on
 *     `errorCode` without re-parsing the response.
 */

const ORIGINAL_ENV = { ...process.env };
const API_BASE = "https://example.test/api";

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

async function loadClient() {
  // Set the env BEFORE loading the module so the `getApiBaseUrl()` call
  // inside `apiCall` reads the test base.
  process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE;
  return import("./talentSearch");
}

function mockJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function mockFetchOnce(response: Response) {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("createTalentSearch", () => {
  it("issues a POST with the trimmed query and bearer token", async () => {
    const { createTalentSearch } = await loadClient();
    const fetchMock = mockFetchOnce(
      mockJsonResponse({ searchId: "search-123" }, { status: 202 }),
    );

    const result = await createTalentSearch("test-token", {
      query: "  someone who can build data dashboards  ",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/talent-searches`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers["Content-Type"]).toBe("application/json");
    // The page trims before calling; this test pins that the wire body
    // is what the caller hands in (trimming happens at the call site).
    expect(JSON.parse(init.body)).toEqual({
      query: "  someone who can build data dashboards  ",
    });
    expect(result).toEqual({ searchId: "search-123" });
  });

  it("propagates talent_search_query_too_short as an ApiError with status 400", async () => {
    const { createTalentSearch } = await loadClient();
    mockFetchOnce(
      new Response(
        JSON.stringify({
          errorCode: "talent_search_query_too_short",
          message: "Write at least 10 characters.",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    try {
      await createTalentSearch("test-token", { query: "abc" });
      throw new Error("expected the request to fail");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.errorCode).toBe("talent_search_query_too_short");
        expect(err.status).toBe(400);
      }
    }
  });

  it("propagates talent_search_busy as an ApiError with status 409", async () => {
    const { createTalentSearch } = await loadClient();
    mockFetchOnce(
      new Response(
        JSON.stringify({
          errorCode: "talent_search_busy",
          message: "A search is already running.",
        }),
        { status: 409, headers: { "content-type": "application/json" } },
      ),
    );

    try {
      await createTalentSearch("test-token", { query: "valid query text" });
      throw new Error("expected the request to fail");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.errorCode).toBe("talent_search_busy");
        expect(err.status).toBe(409);
      }
    }
  });
});

describe("getTalentSearch", () => {
  it("issues a GET to the id path with the bearer token", async () => {
    const { getTalentSearch } = await loadClient();
    const fetchMock = mockFetchOnce(
      mockJsonResponse({
        id: "search-123",
        status: "Completed",
        query: "data dashboards",
        createdAt: "2026-09-21T00:00:00Z",
        completedAt: "2026-09-21T00:00:05Z",
        results: [],
        errorCode: null,
      }),
    );

    const result = await getTalentSearch("test-token", "search-123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/talent-searches/search-123`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(result.status).toBe("Completed");
    expect(result.results).toEqual([]);
  });

  it("URI-encodes the search id in the path", async () => {
    const { getTalentSearch } = await loadClient();
    const fetchMock = mockFetchOnce(
      mockJsonResponse({
        id: "search/abc",
        status: "Pending",
        query: "x",
        createdAt: "2026-09-21T00:00:00Z",
        completedAt: null,
        results: null,
        errorCode: null,
      }),
    );

    await getTalentSearch("test-token", "search/abc");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${API_BASE}/api/discovery/talent-searches/search%2Fabc`,
    );
  });

  it("propagates 404 as an ApiError so the page can stop polling", async () => {
    const { getTalentSearch } = await loadClient();
    mockFetchOnce(
      new Response(
        JSON.stringify({ errorCode: "not_found", message: "Not found." }),
        { status: 404, headers: { "content-type": "application/json" } },
      ),
    );

    await expect(
      getTalentSearch("test-token", "missing-id"),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
    });
  });
});
