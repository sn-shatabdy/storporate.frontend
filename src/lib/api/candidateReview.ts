import { ApiError } from "./errors";

import {
  apiCall,
  buildAuthHeader,
  ensureOkOrThrowApiError,
  getApiBaseUrl,
} from "./client";

/**
 * STOR-44 Phase 4 — employer "drill-down" review surface client.
 *
 * Mirrors the backend's two new endpoints:
 *
 *   - `GET /api/discovery/candidates/{candidateId}`
 *     Returns the candidate's profile (display name, headline,
 *     university, field of study, study year) plus every visible
 *     portfolio item, each with the banded skills the AI attached
 *     and an `original` descriptor when the student shared the source.
 *     `404 candidate_not_found` is the only item-scoped error code;
 *     `401`/`403` are the standard auth gates.
 *
 *   - `GET /api/discovery/candidates/{candidateId}/items/{itemId}/original`
 *     Returns either:
 *         - a streamed binary blob (File items), or
 *         - a `200 { url }` JSON body (Link items).
 *     `404 original_not_shared` / `404 original_unavailable` are the
 *     item-scoped error codes. Auth gates are the same.
 *
 * Wire values are camelCase (the backend serializes with default
 * `JsonNamingPolicy.CamelCase`). All requests follow the shared
 * `apiCall` + `ApiError` convention — `ApiError.errorCode` carries the
 * backend's typed `GlobalExceptionHandler` codes. The binary helper
 * (`fetchCandidateOriginal`) reuses the same base-URL and auth-header
 * helpers that `apiCall` uses, and routes non-OK responses through the
 * same `ensureOkOrThrowApiError` plumbing so the `ApiError` shape is
 * identical across both surfaces.
 */

/** Strength band the backend attaches to each skill, as transmitted by
 *  `GET /api/discovery/candidates/{id}`. Mirrors the talent-search
 *  wire contract (see `src/lib/api/talentSearch.ts`). */
export type CandidateSkillBand = "Strong" | "Developing";

/** Source-kind descriptor for the original file/link a student chose to
 *  share. The endpoint also encodes `available: true` so a future
 *  "tombstoned" original can still report `original != null` but
 *  trigger the unavailable UX — out of scope for STOR-44 Phase 4. */
export type CandidateOriginalKind = "File" | "Link";

export interface CandidateSkill {
  name: string;
  band: CandidateSkillBand;
  /** Null when the item is unshared (always null in that case per the
   *  contract); may also be null on a shared item if the AI didn't
   *  emit a reason. The card renders the pill only when this is null. */
  reason: string | null;
}

export interface CandidateOriginal {
  kind: CandidateOriginalKind;
  available: true;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  host: string | null;
}

export interface CandidateItem {
  portfolioItemId: string;
  label: string;
  category: string;
  shared: boolean;
  skills: CandidateSkill[];
  /** `null` when the student didn't share the original (or the item is
   *  a Link that has no live URL). */
  original: CandidateOriginal | null;
}

export interface CandidateReview {
  candidateId: string;
  displayName: string;
  headline: string | null;
  university: string | null;
  fieldOfStudy: string | null;
  studyYear: number | null;
  items: CandidateItem[];
}

/** Discriminated union returned by `fetchCandidateOriginal`. `kind`
 *  mirrors the underlying endpoint shape: a streamed binary blob for
 *  a File item, or a 200 JSON `{ url }` for a Link item.
 *
 *  - `blob`: the body bytes, the wire `Content-Type` header, the
 *    parsed file name (or null), and an `inline` flag derived from
 *    the response's `Content-Disposition` header (true when the
 *    header starts with `inline`, false when `attachment` or
 *    anything else — including missing). The viewer uses `inline` to
 *    decide whether to render inline preview vs trigger a download.
 *  - `link`: the URL the backend proxies back for a Link item. The
 *    page opens this in a new tab after a synchronous popup stub. */
export type CandidateOriginalResponse =
  | {
      kind: "blob";
      blob: Blob;
      contentType: string;
      fileName: string | null;
      inline: boolean;
    }
  | { kind: "link"; url: string };

/** `GET /api/discovery/candidates/{candidateId}` — full candidate
 *  review payload. Throws `ApiError` on `candidate_not_found`
 *  (404), `permission_denied` (403, e.g. an Organization hitting a
 *  candidate who's turned off visibility — the backend may also
 *  surface this as 404 today), and the standard 401. */
export async function getCandidate(
  bearerToken: string,
  candidateId: string,
  signal?: AbortSignal,
): Promise<CandidateReview> {
  return apiCall<CandidateReview>(
    "GET",
    `/api/discovery/candidates/${encodeURIComponent(candidateId)}`,
    { bearerToken, signal },
  );
}

/**
 * Parse the file name out of a `Content-Disposition` header value.
 *
 * Supports `filename*=UTF-8''<percent-encoded>` (the wire format the
 * backend uses; the spec calls for it because it's the only format
 * that preserves non-ASCII characters through reverse proxies). Falls
 * back to `filename="..."` when present, and to `null` when neither
 * is set. Returns `null` for an empty/undefined header so the caller
 * can render an "Original file" fallback.
 */
export function parseContentDispositionFileName(
  header: string | null,
): string | null {
  if (!header) return null;
  // RFC 5987: `filename*=UTF-8''<percent-encoded>`
  const starMatch = header.match(/filename\*\s*=\s*[^']*''([^;]+)/i);
  if (starMatch && starMatch[1]) {
    try {
      return decodeURIComponent(starMatch[1].trim());
    } catch {
      // Fall through to the plain filename match below on decode error.
    }
  }
  // Plain `filename="..."` or `filename=...` fallback.
  const plainMatch = header.match(/filename\s*=\s*("?)([^";]+)\1/i);
  if (plainMatch && plainMatch[2]) {
    return plainMatch[2].trim();
  }
  return null;
}

/**
 * `true` when the response's `Content-Disposition` header starts
 * with `inline` (e.g. `inline; filename*=UTF-8''...`). `false` for
 * any other header value — including `attachment`, missing, or
 * a different disposition type — so the caller always gets a
 * definitive boolean.
 */
export function isInlineContentDisposition(header: string | null): boolean {
  if (!header) return false;
  return header.trim().toLowerCase().startsWith("inline");
}

/**
 * `GET /api/discovery/candidates/{candidateId}/items/{itemId}/original`
 *
 * Bypasses `apiCall` because the backend can return a streamed binary
 * blob rather than JSON. The auth header and base URL still come from
 * the shared helpers in `./client`, and any non-2xx JSON error body
 * (`{ errorCode, message }`) is parsed via `ensureOkOrThrowApiError`
 * so the caller sees the same `ApiError` shape as every other STOR-43
 * / STOR-44 endpoint.
 *
 * Detection: peek the `Content-Type` header. `application/json`
 * (with a `url` field) → `kind: "link"`. Anything else → `kind:
 * "blob"`. The 200 link payload is parsed from text so the helper
 * works even if the response was negotiated as `application/json`
 * via the browser's default Accept header (which sends every MIME).
 */
export async function fetchCandidateOriginal(
  bearerToken: string,
  candidateId: string,
  portfolioItemId: string,
  signal?: AbortSignal,
): Promise<CandidateOriginalResponse> {
  const baseUrl = getApiBaseUrl();
  const headers: Record<string, string> = {
    Accept: "application/json, */*;q=0.1",
    ...buildAuthHeader(bearerToken),
  };

  const response = await fetch(
    `${baseUrl}/api/discovery/candidates/${encodeURIComponent(
      candidateId,
    )}/items/${encodeURIComponent(portfolioItemId)}/original`,
    { method: "GET", headers, signal },
  );

  await ensureOkOrThrowApiError(response);

  const contentType = response.headers.get("Content-Type") ?? "";
  const lowered = contentType.toLowerCase();
  if (lowered.includes("application/json")) {
    const text = await response.text();
    const parsed: { url?: unknown } = text ? JSON.parse(text) : {};
    if (typeof parsed.url !== "string" || parsed.url.length === 0) {
      throw new ApiError(
        "unknown",
        "Missing url in the link response.",
        response.status,
      );
    }
    return { kind: "link", url: parsed.url };
  }

  const disposition = response.headers.get("Content-Disposition");
  const blob = await response.blob();
  return {
    kind: "blob",
    blob,
    contentType: contentType.split(";")[0]?.trim() ?? "",
    fileName: parseContentDispositionFileName(disposition),
    inline: isInlineContentDisposition(disposition),
  };
}
