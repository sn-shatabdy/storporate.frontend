import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";

/**
 * Tests for the portfolio HTTP client — pins the wire contract for
 * STOR-44 Phase 3's new `updateItemSharing` call so a future refactor that
 * drops the `shareOriginal` field, swaps PUT for POST, or loses the bearer
 * header trips the suite instead of silently breaking the student UI.
 *
 * Mirrors the structure of `discovery.test.ts` — set the env BEFORE
 * loading the module so `getApiBaseUrl()` reads the test base.
 */

const ORIGINAL_ENV = { ...process.env };
const API_BASE = "https://example.test/api";

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

async function loadClient() {
  process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE;
  return import("./portfolio");
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

describe("updateItemSharing", () => {
  it("issues a PUT to /api/portfolio/items/{id}/sharing with the bearer token and JSON body", async () => {
    const { updateItemSharing } = await loadClient();
    const fetchMock = mockFetchOnce(
      mockJsonResponse({
        id: "item-001",
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
        shareOriginalWithEmployers: true,
      }),
    );

    const result = await updateItemSharing("test-token", "item-001", true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/portfolio/items/item-001/sharing`);
    expect(init.method).toBe("PUT");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ shareOriginal: true });
    expect(result.shareOriginalWithEmployers).toBe(true);
  });

  it("passes shareOriginal=false verbatim to the backend", async () => {
    const { updateItemSharing } = await loadClient();
    const fetchMock = mockFetchOnce(
      mockJsonResponse({
        id: "item-001",
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
        shareOriginalWithEmployers: false,
      }),
    );

    await updateItemSharing("test-token", "item-001", false);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ shareOriginal: false });
  });

  it("propagates a backend errorCode as an ApiError", async () => {
    const { updateItemSharing } = await loadClient();
    mockFetchOnce(
      new Response(
        JSON.stringify({ errorCode: "not_found", message: "Item not found." }),
        { status: 404, headers: { "content-type": "application/json" } },
      ),
    );

    // Structural assertion first (the matcher doesn't re-read the body).
    await expect(
      updateItemSharing("test-token", "missing-item", true),
    ).rejects.toMatchObject({
      name: "ApiError",
      errorCode: "not_found",
      status: 404,
    });

    // Second fetch so we can catch and verify the typed class.
    mockFetchOnce(
      new Response(
        JSON.stringify({ errorCode: "not_found", message: "Item not found." }),
        { status: 404, headers: { "content-type": "application/json" } },
      ),
    );
    try {
      await updateItemSharing("test-token", "missing-item", true);
      throw new Error("expected the request to fail");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.errorCode).toBe("not_found");
        expect(err.status).toBe(404);
      }
    }
  });
});
