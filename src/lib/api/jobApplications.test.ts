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
  return import("./jobApplications");
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function stubFetch(response: Response) {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("student endpoints", () => {
  it("applyToJob POSTs an empty body when no name is given", async () => {
    const { applyToJob } = await loadClient();
    const fetchMock = stubFetch(json({ id: "a1" }, { status: 201 }));
    const result = await applyToJob("tok", "j/1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/jobs/j%2F1/applications`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({});
    expect(result).toEqual({ id: "a1" });
  });

  it("applyToJob sends the trimmed display name when given", async () => {
    const { applyToJob } = await loadClient();
    const fetchMock = stubFetch(json({ id: "a1" }, { status: 201 }));
    await applyToJob("tok", "j1", "  Nadia Rahman ");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      displayName: "Nadia Rahman",
    });
  });

  it("applyToJob leaves out a blank display name", async () => {
    const { applyToJob } = await loadClient();
    const fetchMock = stubFetch(json({ id: "a1" }, { status: 201 }));
    await applyToJob("tok", "j1", "   ");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({});
  });

  it.each([
    ["application_already_submitted", 409],
    ["application_display_name_required", 400],
    ["application_display_name_invalid", 400],
    ["job_posting_not_found", 404],
  ])("applyToJob throws ApiError with %s", async (errorCode, status) => {
    const { applyToJob } = await loadClient();
    stubFetch(json({ errorCode, message: "x" }, { status }));
    const error = await applyToJob("tok", "j1").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ errorCode, status });
  });

  it("listMyApplications GETs the collection", async () => {
    const { listMyApplications } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    const result = await listMyApplications("tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/applications`);
    expect(init.method).toBe("GET");
    expect(result).toEqual({ items: [] });
  });
});

describe("employer endpoints", () => {
  it("listApplicants GETs the posting's applications", async () => {
    const { listApplicants } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listApplicants("tok", "p1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/job-postings/p1/applications`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("getApplicant GETs one application with ids encoded", async () => {
    const { getApplicant } = await loadClient();
    const fetchMock = stubFetch(json({ id: "a/1" }));
    await getApplicant("tok", "p1", "a/1");
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE}/api/discovery/job-postings/p1/applications/a%2F1`,
    );
  });

  it("setApplicantStatus POSTs the status", async () => {
    const { setApplicantStatus } = await loadClient();
    const fetchMock = stubFetch(json({ id: "a1", status: "Shortlisted" }));
    await setApplicantStatus("tok", "p1", "a1", "Shortlisted");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `${API_BASE}/api/discovery/job-postings/p1/applications/a1/status`,
    );
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ status: "Shortlisted" });
  });

  it("throws ApiError with application_not_found on 404", async () => {
    const { getApplicant } = await loadClient();
    stubFetch(json({ errorCode: "application_not_found", message: "x" }, { status: 404 }));
    await expect(getApplicant("tok", "p1", "a1")).rejects.toMatchObject({
      errorCode: "application_not_found",
      status: 404,
    });
  });
});
