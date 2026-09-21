import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./errors";

/**
 * Tests for the candidate-review API client (STOR-44 Phase 4). Pins the
 * HTTP contract against the live backend implementation:
 *   - `getCandidate` issues a GET to the id path with the bearer token
 *     and returns the full review payload.
 *   - `fetchCandidateOriginal` discriminates between a streamed binary
 *     (file) response and a 200 JSON `{ url }` (link) response. It
 *     reuses the shared auth + base URL plumbing and routes non-OK
 *     responses through the same `ApiError` shape as `apiCall`.
 *   - Pure helpers (`parseContentDispositionFileName`,
 *     `isInlineContentDisposition`) cover the `inline` flag and the
 *     RFC 5987 `filename*=UTF-8''...` decoding the backend emits.
 *
 * `vi.resetAllMocks()` runs in beforeEach per the project test-integrity
 * convention; we restore process.env in afterEach so a stray unset
 * doesn't bleed across files.
 */

const ORIGINAL_ENV = { ...process.env };
const API_BASE = "https://example.test/api";

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

async function loadClient() {
  process.env.NEXT_PUBLIC_API_BASE_URL = API_BASE;
  return import("./candidateReview");
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

describe("getCandidate", () => {
  it("issues a GET to the candidate path with the bearer token", async () => {
    const { getCandidate } = await loadClient();
    const fetchMock = mockFetchOnce(
      mockJsonResponse({
        candidateId: "cand-1",
        displayName: "Nadia Rahman",
        headline: "Data analyst",
        university: "BUET",
        fieldOfStudy: "CSE",
        studyYear: 4,
        items: [],
      }),
    );

    const result = await getCandidate("test-token", "cand-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/candidates/cand-1`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(result.candidateId).toBe("cand-1");
    expect(result.items).toEqual([]);
  });

  it("URI-encodes the candidate id in the path", async () => {
    const { getCandidate } = await loadClient();
    const fetchMock = mockFetchOnce(
      mockJsonResponse({
        candidateId: "cand/1",
        displayName: "X",
        headline: null,
        university: null,
        fieldOfStudy: null,
        studyYear: null,
        items: [],
      }),
    );

    await getCandidate("test-token", "cand/1");

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/candidates/cand%2F1`);
  });

  it("propagates candidate_not_found as an ApiError with status 404", async () => {
    const { getCandidate } = await loadClient();
    mockFetchOnce(
      new Response(
        JSON.stringify({
          errorCode: "candidate_not_found",
          message: "No such candidate.",
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      ),
    );

    try {
      await getCandidate("test-token", "missing");
      throw new Error("expected the request to fail");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.errorCode).toBe("candidate_not_found");
        expect(err.status).toBe(404);
      }
    }
  });
});

describe("parseContentDispositionFileName", () => {
  it("returns null for an empty / null header", async () => {
    const { parseContentDispositionFileName } = await loadClient();
    expect(parseContentDispositionFileName(null)).toBeNull();
    expect(parseContentDispositionFileName("")).toBeNull();
  });

  it("decodes the RFC 5987 filename* value", async () => {
    const { parseContentDispositionFileName } = await loadClient();
    expect(
      parseContentDispositionFileName("inline; filename*=UTF-8''sales%20dashboard.pdf"),
    ).toBe("sales dashboard.pdf");
    expect(
      parseContentDispositionFileName("attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.docx"),
    ).toBe("résumé.docx");
  });

  it("falls back to plain filename when filename* is missing", async () => {
    const { parseContentDispositionFileName } = await loadClient();
    expect(
      parseContentDispositionFileName('attachment; filename="report.pdf"'),
    ).toBe("report.pdf");
  });

  it("returns null when no filename token is present", async () => {
    const { parseContentDispositionFileName } = await loadClient();
    expect(parseContentDispositionFileName("inline")).toBeNull();
  });

  it("strips CR and LF characters from the parsed file name (replaces with a space)", async () => {
    const { parseContentDispositionFileName } = await loadClient();
    expect(
      parseContentDispositionFileName(
        "inline; filename=\"weird\r\nname.pdf\"",
      ),
    ).toBe("weird  name.pdf");
    expect(
      parseContentDispositionFileName(
        "attachment; filename*=UTF-8''multi%0Dline.txt",
      ),
    ).toBe("multi line.txt");
  });

  it("caps the returned file name at 200 characters, preserving the extension", async () => {
    const { parseContentDispositionFileName } = await loadClient();
    const longBase = "a".repeat(250);
    const longName = `${longBase}.pdf`;
    const result = parseContentDispositionFileName(
      `inline; filename="${longName}"`,
    );
    expect(result).not.toBeNull();
    expect(result!.length).toBe(200);
    expect(result!.endsWith(".pdf")).toBe(true);
    // 200 - 4 (extension) = 196 base chars preserved
    expect(result!.slice(0, -4)).toBe("a".repeat(196));
  });

  it("caps the returned file name at 200 characters without an extension", async () => {
    const { parseContentDispositionFileName } = await loadClient();
    const longName = "a".repeat(500);
    const result = parseContentDispositionFileName(
      `inline; filename="${longName}"`,
    );
    expect(result).not.toBeNull();
    expect(result!.length).toBe(200);
    expect(result).toBe("a".repeat(200));
  });
});

describe("isInlineContentDisposition", () => {
  it("is true when the header starts with inline", async () => {
    const { isInlineContentDisposition } = await loadClient();
    expect(isInlineContentDisposition("inline; filename*=UTF-8''x.pdf")).toBe(true);
    expect(isInlineContentDisposition("  inline; foo=bar")).toBe(true);
    expect(isInlineContentDisposition("INLINE")).toBe(true);
  });

  it("is false for attachment, missing, or other dispositions", async () => {
    const { isInlineContentDisposition } = await loadClient();
    expect(isInlineContentDisposition("attachment; filename=x.pdf")).toBe(false);
    expect(isInlineContentDisposition(null)).toBe(false);
    expect(isInlineContentDisposition("")).toBe(false);
    expect(isInlineContentDisposition("form-data; name=upload")).toBe(false);
  });
});

describe("fetchCandidateOriginal — blob response", () => {
  it("parses an inline file response with an RFC 5987 file name and returns kind=blob with the bytes", async () => {
    const { fetchCandidateOriginal } = await loadClient();
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // "%PDF"
    const fetchMock = mockFetchOnce(
      new Response(bytes, {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition":
            "inline; filename*=UTF-8''sales%20dashboard.pdf",
        },
      }),
    );

    const result = await fetchCandidateOriginal("t", "cand-1", "pi-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${API_BASE}/api/discovery/candidates/cand-1/items/pi-1/original`,
    );
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer t");

    expect(result.kind).toBe("blob");
    if (result.kind === "blob") {
      expect(result.fileName).toBe("sales dashboard.pdf");
      expect(result.inline).toBe(true);
      expect(result.contentType).toBe("application/pdf");
      expect(result.blob).toBeInstanceOf(Blob);
    }
  });

  it("marks inline=false for an attachment Content-Disposition", async () => {
    const { fetchCandidateOriginal } = await loadClient();
    const bytes = new Uint8Array([1, 2, 3]);
    mockFetchOnce(
      new Response(bytes, {
        status: 200,
        headers: {
          "content-type": "application/octet-stream",
          "content-disposition": "attachment; filename=secret.bin",
        },
      }),
    );

    const result = await fetchCandidateOriginal("t", "cand-1", "pi-2");
    expect(result.kind).toBe("blob");
    if (result.kind === "blob") {
      expect(result.inline).toBe(false);
      expect(result.fileName).toBe("secret.bin");
      expect(result.contentType).toBe("application/octet-stream");
    }
  });
});

describe("fetchCandidateOriginal — link response", () => {
  it("parses a JSON { url } body and returns kind=link", async () => {
    const { fetchCandidateOriginal } = await loadClient();
    mockFetchOnce(
      mockJsonResponse(
        { url: "https://github.com/example/project" },
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await fetchCandidateOriginal("t", "cand-1", "pi-3");
    expect(result.kind).toBe("link");
    if (result.kind === "link") {
      expect(result.url).toBe("https://github.com/example/project");
    }
  });

  it("throws ApiError when the JSON link body is missing a url field", async () => {
    const { fetchCandidateOriginal } = await loadClient();
    mockFetchOnce(
      mockJsonResponse({ notUrl: "oops" }, { status: 200 }),
    );

    try {
      await fetchCandidateOriginal("t", "cand-1", "pi-3");
      throw new Error("expected the request to fail");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
    }
  });
});

describe("fetchCandidateOriginal — error handling", () => {
  it("raises an ApiError for a JSON error body (original_not_shared, 404)", async () => {
    const { fetchCandidateOriginal } = await loadClient();
    mockFetchOnce(
      new Response(
        JSON.stringify({
          errorCode: "original_not_shared",
          message: "Original not shared.",
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      ),
    );

    try {
      await fetchCandidateOriginal("t", "cand-1", "pi-1");
      throw new Error("expected the request to fail");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.errorCode).toBe("original_not_shared");
        expect(err.status).toBe(404);
      }
    }
  });

  it("raises an ApiError for original_unavailable (404)", async () => {
    const { fetchCandidateOriginal } = await loadClient();
    mockFetchOnce(
      new Response(
        JSON.stringify({
          errorCode: "original_unavailable",
          message: "Original was removed.",
        }),
        { status: 404, headers: { "content-type": "application/json" } },
      ),
    );

    try {
      await fetchCandidateOriginal("t", "cand-1", "pi-1");
      throw new Error("expected the request to fail");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      if (err instanceof ApiError) {
        expect(err.errorCode).toBe("original_unavailable");
        expect(err.status).toBe(404);
      }
    }
  });

  it("propagates AbortError when the caller aborts the signal", async () => {
    const { fetchCandidateOriginal } = await loadClient();
    const controller = new AbortController();
    const fn = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        }),
    );
    vi.stubGlobal("fetch", fn);

    const promise = fetchCandidateOriginal("t", "cand-1", "pi-1", controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("propagates AbortError for getCandidate as well", async () => {
    const { getCandidate } = await loadClient();
    const controller = new AbortController();
    const fn = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal?.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        }),
    );
    vi.stubGlobal("fetch", fn);

    const promise = getCandidate("t", "cand-1", controller.signal);
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});
