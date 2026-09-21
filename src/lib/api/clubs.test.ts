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
  return import("./clubs");
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function stubFetch(response: Response) {
  const body = response.clone();
  const fn = vi.fn().mockImplementation(async () => body.clone());
  vi.stubGlobal("fetch", fn);
  return fn;
}

const REQUEST = {
  name: "Data Science Club",
  tagline: null,
  about: "We run weekly data sessions for students.",
  university: "BUET",
  city: null,
  foundedYear: null,
  memberCount: 120,
  audience: { fieldsOfStudy: ["Computer Science"], years: [1, 2] },
  events: [],
};

describe("club endpoints", () => {
  it("getMyClubProfile GETs the profile with the bearer token", async () => {
    const { getMyClubProfile } = await loadClient();
    const fetchMock = stubFetch(json({ id: "c1", name: "X" }));
    const result = await getMyClubProfile("tok");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/clubs/profile`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(result).toMatchObject({ id: "c1" });
  });

  it("getMyClubProfile returns null on club_profile_not_found", async () => {
    const { getMyClubProfile } = await loadClient();
    stubFetch(
      json({ errorCode: "club_profile_not_found", message: "none" }, { status: 404 }),
    );
    expect(await getMyClubProfile("tok")).toBeNull();
  });

  it("getMyClubProfile rethrows other errors", async () => {
    const { getMyClubProfile } = await loadClient();
    stubFetch(json({ errorCode: "boom", message: "bad" }, { status: 500 }));
    await expect(getMyClubProfile("tok")).rejects.toBeInstanceOf(ApiError);
  });

  it("saveClubProfile PUTs the body", async () => {
    const { saveClubProfile } = await loadClient();
    const fetchMock = stubFetch(json({ id: "c1" }));
    await saveClubProfile("tok", REQUEST);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/api/clubs/profile`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual(REQUEST);
  });

  it("publish and unpublish POST to their paths", async () => {
    const { publishClubProfile, unpublishClubProfile } = await loadClient();
    const fetchMock = stubFetch(json({ id: "c1" }));
    await publishClubProfile("tok");
    await unpublishClubProfile("tok");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/clubs/profile/publish`);
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toBe(`${API_BASE}/api/clubs/profile/unpublish`);
  });

  it("publish surfaces club_profile_incomplete with its message", async () => {
    const { publishClubProfile } = await loadClient();
    stubFetch(
      json(
        { errorCode: "club_profile_incomplete", message: "Add a year." },
        { status: 400 },
      ),
    );
    await expect(publishClubProfile("tok")).rejects.toMatchObject({
      errorCode: "club_profile_incomplete",
      message: "Add a year.",
    });
  });

  it("listClubs leaves empty filters out and encodes the rest", async () => {
    const { listClubs } = await loadClient();
    const fetchMock = stubFetch(json({ items: [] }));
    await listClubs("tok");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/clubs`);
    await listClubs("tok", { q: " data ", field: "Computer Science", university: "  " });
    expect(fetchMock.mock.calls[1][0]).toBe(
      `${API_BASE}/api/clubs?q=data&field=Computer+Science`,
    );
  });

  it("getClub GETs one club by encoded id", async () => {
    const { getClub } = await loadClient();
    const fetchMock = stubFetch(json({ id: "a/b" }));
    await getClub("tok", "a/b");
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_BASE}/api/clubs/a%2Fb`);
  });

  it("exposes the labels and lists", async () => {
    const { FREQUENCY_LABELS, SUPPORT_NEEDS } = await loadClient();
    expect(FREQUENCY_LABELS.Termly).toBe("Every term");
    expect(FREQUENCY_LABELS.OneOff).toBe("One-off");
    expect(SUPPORT_NEEDS).toHaveLength(8);
  });
});
