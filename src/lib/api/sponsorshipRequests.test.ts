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
  return import("./sponsorshipRequests");
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

const CREATE = {
  goalId: "goal-1",
  eventTitle: "  Dhaka Hack Night ",
  eventDate: "2026-11-14",
  eventDescription: " A long enough description here. ",
  ask: " Cash for prizes ",
  amountRequested: 50000,
  offer: " Logo on banners ",
};

describe("club endpoints", () => {
  it("createRequest POSTs the trimmed body", async () => {
    const { createRequest } = await loadClient();
    const fetchMock = stubFetch(json({ id: "r1" }, { status: 201 }));
    const result = await createRequest("tok", CREATE);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/requests`);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({
      goalId: "goal-1",
      eventTitle: "Dhaka Hack Night",
      eventDate: "2026-11-14",
      eventDescription: "A long enough description here.",
      ask: "Cash for prizes",
      amountRequested: 50000,
      offer: "Logo on banners",
    });
    expect(result).toEqual({ id: "r1" });
  });

  it("createRequest keeps a null date and amount", async () => {
    const { createRequest } = await loadClient();
    const fetchMock = stubFetch(json({ id: "r1" }, { status: 201 }));
    await createRequest("tok", { ...CREATE, eventDate: null, amountRequested: null });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.eventDate).toBeNull();
    expect(body.amountRequested).toBeNull();
  });

  it("listSentRequests leaves status out when not filtering", async () => {
    const { listSentRequests } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listSentRequests("tok");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/sponsorship/requests/sent`);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("listSentRequests sends the status filter", async () => {
    const { listSentRequests } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listSentRequests("tok", "InDiscussion");
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE}/api/sponsorship/requests/sent?status=InDiscussion`,
    );
  });

  it("getSentRequest encodes the id", async () => {
    const { getSentRequest } = await loadClient();
    const fetchMock = stubFetch(json({ id: "a b" }));
    await getSentRequest("tok", "a b");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/sponsorship/requests/sent/a%20b`);
  });

  it("sendSentRequestMessage POSTs a trimmed body", async () => {
    const { sendSentRequestMessage } = await loadClient();
    const fetchMock = stubFetch(json({ id: "r1" }, { status: 201 }));
    await sendSentRequestMessage("tok", "r1", "  hello ");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/requests/sent/r1/messages`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ body: "hello" });
  });

  it("completeSentRequest POSTs the outcome", async () => {
    const { completeSentRequest } = await loadClient();
    const fetchMock = stubFetch(json({ id: "r1" }));
    await completeSentRequest("tok", "r1", { outcomeNote: " Done ", agreedAmount: 40000 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/requests/sent/r1/complete`);
    expect(JSON.parse(init.body)).toEqual({ outcomeNote: "Done", agreedAmount: 40000 });
  });
});

describe("company endpoints", () => {
  it("listReceivedRequests sends the status filter", async () => {
    const { listReceivedRequests } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listReceivedRequests("tok", "Sent");
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${API_BASE}/api/sponsorship/requests/received?status=Sent`,
    );
  });

  it("getReceivedRequest GETs one request", async () => {
    const { getReceivedRequest } = await loadClient();
    const fetchMock = stubFetch(json({ id: "r1" }));
    await getReceivedRequest("tok", "r1");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/sponsorship/requests/received/r1`);
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("sendReceivedRequestMessage POSTs to messages", async () => {
    const { sendReceivedRequestMessage } = await loadClient();
    const fetchMock = stubFetch(json({ id: "r1" }, { status: 201 }));
    await sendReceivedRequestMessage("tok", "r1", "Question?");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/requests/received/r1/messages`);
    expect(JSON.parse(init.body)).toEqual({ body: "Question?" });
  });

  it("acceptRequest POSTs the note", async () => {
    const { acceptRequest } = await loadClient();
    const fetchMock = stubFetch(json({ id: "r1" }));
    await acceptRequest("tok", "r1", " Welcome ");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/requests/received/r1/accept`);
    expect(JSON.parse(init.body)).toEqual({ note: "Welcome" });
  });

  it("declineRequest POSTs the reason", async () => {
    const { declineRequest } = await loadClient();
    const fetchMock = stubFetch(json({ id: "r1" }));
    await declineRequest("tok", "r1", "Not now");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/requests/received/r1/decline`);
    expect(JSON.parse(init.body)).toEqual({ reason: "Not now" });
  });

  it("completeReceivedRequest POSTs a null amount as null", async () => {
    const { completeReceivedRequest } = await loadClient();
    const fetchMock = stubFetch(json({ id: "r1" }));
    await completeReceivedRequest("tok", "r1", { outcomeNote: "Done", agreedAmount: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/sponsorship/requests/received/r1/complete`);
    expect(JSON.parse(init.body)).toEqual({ outcomeNote: "Done", agreedAmount: null });
  });
});

describe("errors", () => {
  it("maps a 409 body to an ApiError with the code", async () => {
    const { createRequest } = await loadClient();
    stubFetch(
      json(
        { errorCode: "sponsorship_request_duplicate", message: "Already open." },
        { status: 409 },
      ),
    );
    await expect(createRequest("tok", CREATE)).rejects.toMatchObject({
      errorCode: "sponsorship_request_duplicate",
      status: 409,
    });
  });

  it("maps a 404 body to an ApiError", async () => {
    const { getSentRequest } = await loadClient();
    stubFetch(json({ errorCode: "sponsorship_request_not_found", message: "x" }, { status: 404 }));
    const error = await getSentRequest("tok", "r1").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.errorCode).toBe("sponsorship_request_not_found");
  });
});
