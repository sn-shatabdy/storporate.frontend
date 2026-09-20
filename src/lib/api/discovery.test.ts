import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";

/**
 * Tests for the discovery surface client (STORAGE-43 Phase 3). Pins the
 * HTTP contract against the live backend implementation:
 *   - getSearchableProfile issues a GET to the right path with the bearer
 *     token header.
 *   - updateSearchableProfile issues a PUT to the right path with the JSON
 *     body and bearer token.
 *   - Non-2xx responses bubble up as a typed `ApiError` carrying the
 *     backend's `errorCode` and HTTP status (so the page can switch on
 *     errorCode without re-parsing the response).
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
  return import("./discovery");
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

describe("getSearchableProfile", () => {
  it("issues a GET to /api/discovery/searchable-profile with the bearer token", async () => {
    const { getSearchableProfile } = await loadClient();
    const fetchMock = mockFetchOnce(
      mockJsonResponse({
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
      }),
    );

    const profile = await getSearchableProfile("test-token");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/searchable-profile`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers.Accept).toBe("application/json");
    expect(profile.isSearchable).toBe(false);
    expect(profile.visibleItemCount).toBe(0);
  });
});

describe("updateSearchableProfile", () => {
  it("issues a PUT with the JSON body and bearer token", async () => {
    const { updateSearchableProfile } = await loadClient();
    const fetchMock = mockFetchOnce(
      mockJsonResponse({
        isSearchable: true,
        displayName: "Nadia Rahman",
        headline: null,
        university: "BUET",
        fieldOfStudy: null,
        studyYear: 3,
        showHeadline: true,
        showUniversity: true,
        showFieldOfStudy: true,
        showStudyYear: true,
        optedInAt: "2026-09-21T00:00:00Z",
        updatedAt: "2026-09-21T00:00:00Z",
        visibleItemCount: 0,
      }),
    );

    const profile = await updateSearchableProfile("test-token", {
      isSearchable: true,
      displayName: "Nadia Rahman",
      university: "BUET",
      studyYear: 3,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/searchable-profile`);
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      isSearchable: true,
      displayName: "Nadia Rahman",
      university: "BUET",
      studyYear: 3,
    });
    expect(profile.isSearchable).toBe(true);
    expect(profile.displayName).toBe("Nadia Rahman");
  });

  it("propagates a backend errorCode as an ApiError", async () => {
    const { updateSearchableProfile } = await loadClient();
    mockFetchOnce(
      new Response(
        JSON.stringify({ errorCode: "display_name_required", message: "Provide a display name." }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );

    // First call: structural assertions (the `toMatchObject` matcher
    // doesn't read the response body again, so this is safe).
    await expect(
      updateSearchableProfile("test-token", { displayName: "" }),
    ).rejects.toMatchObject({
      name: "ApiError",
      errorCode: "display_name_required",
      status: 400,
    });

    // Spot-check that the thrown value really is the typed error class —
    // call sites use `instanceof ApiError`, not just a structural check.
    // The mock factory below creates a fresh body for this call.
    mockFetchOnce(
      new Response(
        JSON.stringify({ errorCode: "display_name_required", message: "Provide a display name." }),
        { status: 400, headers: { "content-type": "application/json" } },
      ),
    );
    try {
      await updateSearchableProfile("test-token", { displayName: "" });
      throw new Error("expected the request to fail");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.errorCode).toBe("display_name_required");
        expect(err.status).toBe(400);
      }
    }
  });
});
