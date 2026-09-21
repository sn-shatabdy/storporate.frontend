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
  return import("./jobPostings");
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

const BODY = {
  title: "Junior data analyst",
  kind: "Job" as const,
  companyName: "Acme",
  location: null,
  workMode: "Remote" as const,
  description: "Build dashboards and clean sales data.",
  requiredSkills: ["Power BI"],
};

describe("employer endpoints", () => {
  it("listMyPostings GETs the collection with the bearer token", async () => {
    const { listMyPostings } = await loadClient();
    const fetchMock = stubFetch(json({ items: [], counts: { open: 0, paused: 0, closed: 0, total: 0 } }));
    const result = await listMyPostings("tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/job-postings`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(result.counts.total).toBe(0);
  });

  it("listMyPostings sends status and a trimmed q, and skips them when empty", async () => {
    const { listMyPostings } = await loadClient();
    const fetchMock = stubFetch(json({ items: [], counts: { open: 0, paused: 0, closed: 0, total: 0 } }));
    await listMyPostings("tok", { status: "Open", q: "  power bi " });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("status")).toBe("Open");
    expect(url.searchParams.get("q")).toBe("power bi");

    const second = stubFetch(json({ items: [], counts: { open: 0, paused: 0, closed: 0, total: 0 } }));
    await listMyPostings("tok", { q: "   " });
    const secondUrl = new URL(second.mock.calls[0][0]);
    expect(secondUrl.searchParams.get("q")).toBeNull();
  });

  it("getMyPosting GETs one posting with the id encoded", async () => {
    const { getMyPosting } = await loadClient();
    const fetchMock = stubFetch(json({ id: "a/b" }));
    await getMyPosting("tok", "a/b");
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE}/api/discovery/job-postings/a%2Fb`,
    );
  });

  it("createPosting POSTs the JSON body", async () => {
    const { createPosting } = await loadClient();
    const fetchMock = stubFetch(json({ id: "new" }, { status: 201 }));
    const result = await createPosting("tok", BODY);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/job-postings`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(BODY);
    expect(result).toEqual({ id: "new" });
  });

  it("updatePosting PUTs the JSON body to the posting", async () => {
    const { updatePosting } = await loadClient();
    const fetchMock = stubFetch(json({ id: "j1" }));
    await updatePosting("tok", "j1", BODY);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/job-postings/j1`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(BODY);
  });

  it("setPostingStatus POSTs the status to the status path", async () => {
    const { setPostingStatus } = await loadClient();
    const fetchMock = stubFetch(json({ id: "j1", status: "Paused" }));
    await setPostingStatus("tok", "j1", "Paused");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/job-postings/j1/status`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ status: "Paused" });
  });

  it("throws ApiError with the backend code on 409", async () => {
    const { updatePosting } = await loadClient();
    stubFetch(
      json({ errorCode: "job_posting_closed", message: "Closed." }, { status: 409 }),
    );
    await expect(updatePosting("tok", "j1", BODY)).rejects.toMatchObject({
      errorCode: "job_posting_closed",
      status: 409,
    });
    stubFetch(
      json({ errorCode: "job_posting_not_found", message: "x" }, { status: 404 }),
    );
    await expect(updatePosting("tok", "j1", BODY)).rejects.toBeInstanceOf(ApiError);
  });

  it("maps job_posting_conflict and the phase 1 400 codes through ApiError", async () => {
    const { updatePosting } = await loadClient();
    stubFetch(
      json(
        { errorCode: "job_posting_compensation_invalid", message: "x" },
        { status: 400 },
      ),
    );
    await expect(updatePosting("tok", "j1", BODY)).rejects.toMatchObject({
      errorCode: "job_posting_compensation_invalid",
      status: 400,
    });
  });
});

describe("student endpoints", () => {
  it("listJobs sends no query string without filters", async () => {
    const { listJobs } = await loadClient();
    const fetchMock = stubFetch(json({ items: [], page: 1, pageSize: 20, total: 0 }));
    await listJobs("tok");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/discovery/jobs`);
  });

  it("listJobs sends kind, workMode and trimmed q, and skips empties", async () => {
    const { listJobs } = await loadClient();
    const fetchMock = stubFetch(json({ items: [], page: 1, pageSize: 20, total: 0 }));
    await listJobs("tok", { kind: "Internship", workMode: "Remote", q: "  power bi " });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/api/discovery/jobs");
    expect(url.searchParams.get("kind")).toBe("Internship");
    expect(url.searchParams.get("workMode")).toBe("Remote");
    expect(url.searchParams.get("q")).toBe("power bi");

    const second = stubFetch(json({ items: [], page: 1, pageSize: 20, total: 0 }));
    await listJobs("tok", { q: "   " });
    expect(second.mock.calls[0][0]).toBe(`${API_BASE}/api/discovery/jobs`);
  });

  it("listJobs sends sort, page and pageSize when set", async () => {
    const { listJobs } = await loadClient();
    const fetchMock = stubFetch(json({ items: [], page: 2, pageSize: 20, total: 46 }));
    await listJobs("tok", { sort: "newest", page: 2, pageSize: 20 });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get("sort")).toBe("newest");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("pageSize")).toBe("20");
  });

  it("getJob GETs one job with fit", async () => {
    const { getJob } = await loadClient();
    const fetchMock = stubFetch(json({ id: "j1" }));
    await getJob("tok", "j1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/jobs/j1`);
    expect(init.method).toBe("GET");
  });
});