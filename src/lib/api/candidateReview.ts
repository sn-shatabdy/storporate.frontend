import { ApiError } from "./errors";

import {
  apiCall,
  buildAuthHeader,
  ensureOkOrThrowApiError,
  getApiBaseUrl,
} from "./client";

/** Employer "drill-down" review surface client. Mirrors the backend's
 *  two endpoints: `GET /api/discovery/candidates/{candidateId}` and
 *  `GET /api/discovery/candidates/{candidateId}/items/{itemId}/original`.
 *  Wire values are camelCase (the backend serializes with default
 *  `JsonNamingPolicy.CamelCase`). */

/** Strength band the backend attaches to each skill, as transmitted
 *  by `GET /api/discovery/candidates/{id}`. */
export type CandidateSkillBand = "Strong" | "Developing";

/** Source-kind descriptor for the original file/link a student chose
 *  to share. The `available: true` discriminator leaves room for a
 *  future "tombstoned" original that still reports `original != null`
 *  but triggers the unavailable UX. */
export type CandidateOriginalKind = "File" | "Link";

export interface CandidateSkill {
  name: string;
  band: CandidateSkillBand;
  /** Null on an unshared item (always) or when the AI emitted no
   *  reason; the card renders the pill only. */
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
   *  a Link with no live URL). */
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

/** Discriminated union returned by `fetchCandidateOriginal`.
 *  - `blob`: body bytes, wire `Content-Type`, parsed file name (or null),
 *    and an `inline` flag derived from the response's
 *    `Content-Disposition` header (true when the header starts with
 *    `inline`, false otherwise). The viewer uses `inline` to decide
 *    inline preview vs download.
 *  - `link`: the URL the backend proxies back for a Link item. */
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
 *  review payload. Throws `ApiError` on `candidate_not_found` (404),
 *  `permission_denied` (403), and the standard 401. */
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

/** Parse the file name out of a `Content-Disposition` header value.
 *  Supports `filename*=UTF-8''<percent-encoded>` (the wire format the
 *  backend uses; RFC 5987 is the only format that preserves
 *  non-ASCII characters through reverse proxies). Falls back to
 *  `filename="..."` when present, and to `null` otherwise. */
export function parseContentDispositionFileName(
  header: string | null,
): string | null {
  if (!header) return null;
  // RFC 5987: `filename*=UTF-8''<percent-encoded>`
  const starMatch = header.match(/filename\*\s*=\s*[^']*''([^;]+)/i);
  let raw: string | null = null;
  if (starMatch && starMatch[1]) {
    try {
      raw = decodeURIComponent(starMatch[1]);
    } catch {
      raw = null;
    }
  }
  if (raw === null) {
    // Plain `filename="..."` or `filename=...` fallback.
    const plainMatch = header.match(/filename\s*=\s*("?)([^";]+)\1/i);
    if (plainMatch && plainMatch[2]) {
      raw = plainMatch[2];
    }
  }
  if (raw === null) return null;
  return capFileName(
    raw.replace(/\r/g, " ").replace(/\n/g, " ").trim(),
    MAX_FILE_NAME,
  );
}

/** Maximum length of a parsed file name returned by
 *  `parseContentDispositionFileName`. */
const MAX_FILE_NAME = 200;

/** Trim a file name to `max` characters, preserving the extension
 *  when one is present. Names shorter than the cap are returned as-is. */
function capFileName(name: string, max: number): string {
  if (name.length <= max) return name;
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex >= name.length - 1) {
    return name.slice(0, max);
  }
  const extension = name.slice(dotIndex);
  // Always leave room for the extension + the dot.
  const keep = max - extension.length;
  if (keep <= 0) return name.slice(0, max);
  return name.slice(0, keep) + extension;
}

/** `true` when the response's `Content-Disposition` header starts with
 *  `inline` (e.g. `inline; filename*=UTF-8''...`); `false` for any
 *  other value — including `attachment`, missing, or a different
 *  disposition type. */
export function isInlineContentDisposition(header: string | null): boolean {
  if (!header) return false;
  return header.trim().toLowerCase().startsWith("inline");
}

/** `GET /api/discovery/candidates/{candidateId}/items/{itemId}/original`.
 *  Bypasses `apiCall` because the backend can return a streamed binary
 *  blob rather than JSON. Auth header + base URL still come from
 *  `./client`, and non-2xx JSON error bodies route through
 *  `ensureOkOrThrowApiError` so callers see the same `ApiError` shape. */
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
