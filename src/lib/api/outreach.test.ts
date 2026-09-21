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
  return import("./outreach");
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

describe("shortlist endpoints", () => {
  it("addToShortlist POSTs the candidate id", async () => {
    const { addToShortlist } = await loadClient();
    const fetchMock = stubFetch(json({ candidateId: "c1" }, { status: 201 }));
    const result = await addToShortlist("tok", "c1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/shortlist`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ candidateId: "c1" });
    expect(result).toEqual({ candidateId: "c1" });
  });

  it("addToShortlist throws ApiError for candidate_not_found", async () => {
    const { addToShortlist } = await loadClient();
    stubFetch(json({ errorCode: "candidate_not_found", message: "x" }, { status: 404 }));
    const error = await addToShortlist("tok", "c1").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ errorCode: "candidate_not_found", status: 404 });
  });

  it("listShortlist GETs the collection", async () => {
    const { listShortlist } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    const result = await listShortlist("tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/shortlist`);
    expect(init.method).toBe("GET");
    expect(result).toEqual({ items: [] });
  });

  it("removeFromShortlist DELETEs and resolves on 204", async () => {
    const { removeFromShortlist } = await loadClient();
    const fetchMock = stubFetch(new Response(null, { status: 204 }));
    await expect(removeFromShortlist("tok", "c/1")).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/shortlist/c%2F1`);
    expect(init.method).toBe("DELETE");
  });
});

describe("employer outreach endpoints", () => {
  it("startOutreach POSTs trimmed values", async () => {
    const { startOutreach } = await loadClient();
    const fetchMock = stubFetch(json({ id: "o1" }, { status: 201 }));
    await startOutreach("tok", {
      candidateId: "c1",
      organizationName: "  Acme Analytics ",
      message: " Hello there ",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/outreach`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      candidateId: "c1",
      organizationName: "Acme Analytics",
      message: "Hello there",
    });
  });

  it.each([
    ["outreach_organization_name_invalid", 400],
    ["outreach_message_invalid", 400],
    ["outreach_already_started", 409],
    ["outreach_declined", 409],
    ["candidate_not_found", 404],
  ])("startOutreach throws ApiError with %s", async (errorCode, status) => {
    const { startOutreach } = await loadClient();
    stubFetch(json({ errorCode, message: "x" }, { status }));
    const error = await startOutreach("tok", {
      candidateId: "c1",
      organizationName: "Acme",
      message: "Hi",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ errorCode, status });
  });

  it("listMyOutreach and getOutreach GET their paths", async () => {
    const { listMyOutreach, getOutreach } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listMyOutreach("tok");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/discovery/outreach`);
    fetchMock.mockResolvedValue(json({ id: "o/1", messages: [] }));
    await getOutreach("tok", "o/1");
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE}/api/discovery/outreach/o%2F1`);
    expect(fetchMock.mock.calls[1][1].method).toBe("GET");
  });

  it("sendOutreachMessage POSTs the message", async () => {
    const { sendOutreachMessage } = await loadClient();
    const fetchMock = stubFetch(json({ id: "o1" }, { status: 201 }));
    await sendOutreachMessage("tok", "o1", " Thanks ");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/outreach/o1/messages`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ message: "Thanks" });
  });

  it("sendOutreachMessage throws ApiError for outreach_awaiting_reply", async () => {
    const { sendOutreachMessage } = await loadClient();
    stubFetch(json({ errorCode: "outreach_awaiting_reply", message: "x" }, { status: 409 }));
    const error = await sendOutreachMessage("tok", "o1", "Hi").catch((e) => e);
    expect(error).toMatchObject({ errorCode: "outreach_awaiting_reply", status: 409 });
  });
});

describe("student inbox endpoints", () => {
  it("listInbox and getInboxConversation GET their paths", async () => {
    const { listInbox, getInboxConversation } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listInbox("tok");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/discovery/inbox`);
    fetchMock.mockResolvedValue(json({ id: "o1", messages: [] }));
    await getInboxConversation("tok", "o1");
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE}/api/discovery/inbox/o1`);
  });

  it("replyToInvitation POSTs the message", async () => {
    const { replyToInvitation } = await loadClient();
    const fetchMock = stubFetch(json({ id: "o1" }));
    await replyToInvitation("tok", "o1", " Yes ");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/inbox/o1/reply`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ message: "Yes" });
  });

  it("declineInvitation POSTs without a body", async () => {
    const { declineInvitation } = await loadClient();
    const fetchMock = stubFetch(json({ id: "o1", status: "Declined" }));
    const result = await declineInvitation("tok", "o1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/discovery/inbox/o1/decline`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(result).toMatchObject({ status: "Declined" });
  });

  it("throws ApiError for outreach_not_found", async () => {
    const { declineInvitation } = await loadClient();
    stubFetch(json({ errorCode: "outreach_not_found", message: "x" }, { status: 404 }));
    const error = await declineInvitation("tok", "o1").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ errorCode: "outreach_not_found", status: 404 });
  });
});
