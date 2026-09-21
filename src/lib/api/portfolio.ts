import { apiCall, getApiBaseUrl, throwForErrorResponse } from "./client";
import type { PagedResult } from "./pagination";

/**
 * Mirrors `Storporate.Modules.Portfolio.PortfolioItemResponse` (camelCase
 * over the wire). `StorageKey` is intentionally not exposed here — it stays
 * a server-side implementation detail of the `IArtifactStore` contract, just
 * like the audit log's `Hash`/`PreviousHash` fields are omitted from the
 * client-visible shape.
 */
export interface PortfolioItem {
  id: string;
  label: string;
  category: string;
  customCategoryText: string | null;
  submissionType: "File" | "Link";
  originalFileName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  externalUrl: string | null;
  description: string | null;
  createdAt: string;
  // STOR-38: per-item AI analysis rollup surfaced on the list row so a
  // student can see at a glance which items have been looked at. Full
  // skill breakdown (incl. explanation) lives at
  // `GET /api/portfolio/items/{id}/analysis` (see `getPortfolioItemAnalysis`).
  analysisStatus:
    | "NotAnalyzed"
    | "Analyzing"
    | "Analyzed"
    | "Failed"
    | "Unsupported";
  lastAnalyzedAt: string | null;
  // STOR-39: condensed AI skill preview surfaced directly on the list row
  // (skill name + confidence band only — no explanation). Analyzed items
  // return one entry per finding; not-yet-analyzed items return `[]`. The
  // single bulk fetch against the backend's `PortfolioSkillFindings` table
  // means this stays N+1-free (see STOR-39 Phase 1).
  skills: PortfolioSkillPreview[];
  // STOR-44 Phase 3: per-item "share original with employers" flag. When
  // true, an employer who finds the student may open this item's original
  // file/link AND read the AI's written reason for each skill rating (the
  // latter is the new capability introduced in Phase 3 — the original file
  // itself was already gated by a per-item toggle in an earlier phase, but
  // the per-skill reasoning visibility is new). Default false everywhere
  // except where the student has explicitly turned it on.
  shareOriginalWithEmployers: boolean;
}

/** Condensed skill-preview shape returned by `GET /api/portfolio/items` —
 * `skillName` + `confidenceBand` only, deliberately omitting `explanation`
 * (which only the detail page needs). Mirrors the backend's
 * `PortfolioSkillPreview` record 1:1. */
export interface PortfolioSkillPreview {
  skillName: string;
  confidenceBand: "Strong" | "Developing" | "Missing";
}

/** One skill reported by the AI analysis pipeline. */
export interface PortfolioSkillFinding {
  skillName: string;
  confidenceBand: "Strong" | "Developing" | "Missing";
  explanation: string;
}

/** Full analysis payload for a single portfolio item. */
export interface PortfolioItemAnalysis {
  status:
    | "NotAnalyzed"
    | "Analyzing"
    | "Analyzed"
    | "Failed"
    | "Unsupported";
  lastAnalyzedAt: string | null;
  errorMessage: string | null;
  skills: PortfolioSkillFinding[];
}

/**
 * The fixed wire-value / display-label pairs for `PortfolioItem.category`.
 * The wire value is what's POSTed to the backend (must match the C#
 * `PortfolioCategories` constants exactly — the backend rejects anything not
 * in that set with `category_unrecognized`); the label is what the student
 * sees in the `<select>` options.
 */
export const PORTFOLIO_CATEGORIES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "Document", label: "Document" },
  { value: "PortfolioLink", label: "Portfolio Link" },
  { value: "Dataset", label: "Dataset" },
  { value: "ResearchPaper", label: "Research Paper" },
  { value: "BusinessPlan", label: "Business Plan" },
  { value: "DesignFile", label: "Design File" },
  { value: "Video", label: "Video" },
  { value: "Certificate", label: "Certificate" },
  { value: "Project", label: "Project" },
  { value: "Other", label: "Other" },
];

/** The hard 100 MB upload cap, mirrored from
 * `Storporate.Modules.Portfolio.CreatePortfolioItemValidator.MaxFileSizeBytes`. */
export const MAX_PORTFOLIO_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/** The exact set of content types the backend accepts for an uploaded file —
 * mirrored from `CreatePortfolioItemValidator.AllowedContentTypes` so we can
 * fail fast in the browser instead of round-tripping a request the server
 * will reject. */
export const ALLOWED_PORTFOLIO_FILE_CONTENT_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/zip",
]);

/** Wire-value of the "Other" category — kept here so the form can do a single
 * `category === PORTFOLIO_OTHER_CATEGORY` check without re-typing the string
 * literal (and so a future rename of the wire value stays a one-line change). */
export const PORTFOLIO_OTHER_CATEGORY = "Other";

/**
 * Fetches a single page of the signed-in student's portfolio items via
 * `GET /api/portfolio/items`. The endpoint's own `[RequirePermission]` gate
 * is the real authorization check; the dashboard layout guard only redirects
 * non-Student visitors off the URL.
 */
export async function listPortfolioItems(
  pageNumber: number,
  pageSize: number,
  accessToken: string,
  signal?: AbortSignal,
): Promise<PagedResult<PortfolioItem>> {
  const params = new URLSearchParams();
  params.set("pageNumber", String(pageNumber));
  params.set("pageSize", String(pageSize));
  params.set("sortBy", "createdAt");
  params.set("sortDescending", "true");

  return apiCall<PagedResult<PortfolioItem>>(
    "GET",
    `/api/portfolio/items?${params.toString()}`,
    { bearerToken: accessToken, signal },
  );
}

/**
 * Shape of a single portfolio-item upload. `file` and `externalUrl` are
 * intentionally both optional at the TS level so the same shape can carry
 * either a file submission or a link submission — the "exactly one of
 * these" invariant is enforced by the form (and re-checked by the backend
 * validator) rather than by the type.
 */
export interface UploadPortfolioItemInput {
  label: string;
  category: string;
  customCategoryText?: string;
  description?: string;
  externalUrl?: string;
  file?: File;
}

/**
 * `POST /api/portfolio/items` — submits a new portfolio item as multipart
 * form data. Bypasses the shared {@link apiCall} helper because that helper
 * always JSON-serializes its body and always sets
 * `Content-Type: application/json`, neither of which is what a multipart
 * upload needs — the browser sets the `Content-Type` (with boundary) on its
 * own as soon as we hand it a `FormData` body.
 *
 * Error handling mirrors `apiCall`'s: parse the `{errorCode, message}` body
 * the backend's `GlobalExceptionHandler` produces and throw an
 * {@link ApiError}.
 */
export async function uploadPortfolioItem(
  input: UploadPortfolioItemInput,
  accessToken: string,
  signal?: AbortSignal,
): Promise<PortfolioItem> {
  const formData = new FormData();
  formData.append("label", input.label);
  formData.append("category", input.category);
  if (input.customCategoryText) {
    formData.append("customCategoryText", input.customCategoryText);
  }
  if (input.description) {
    formData.append("description", input.description);
  }
  if (input.externalUrl) {
    formData.append("externalUrl", input.externalUrl);
  }
  if (input.file) {
    // Backend reads the file via `form.Files.GetFile("file")` (with a
    // fallback to the first file) — using the exact "file" field name keeps
    // the binding explicit rather than relying on the fallback.
    formData.append("file", input.file);
  }

  const response = await fetch(`${getApiBaseUrl()}/api/portfolio/items`, {
    method: "POST",
    // Intentionally NO `Content-Type` header — the browser sets the multipart
    // boundary itself when the body is a `FormData`.
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
    signal,
  });

  if (!response.ok) {
    await throwForErrorResponse(response);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as PortfolioItem;
}

/** `DELETE /api/portfolio/items/{id}` — returns `204` on success, `404` if the
 * item doesn't exist or belongs to a different account (the backend treats
 * the latter identically to the former to avoid existence leaks). */
export async function deletePortfolioItem(
  id: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiCall<void>("DELETE", `/api/portfolio/items/${id}`, {
    bearerToken: accessToken,
    signal,
  });
}

/** `GET /api/portfolio/items/{id}/analysis` — full AI analysis rollup for a
 * single item, including per-skill `confidenceBand` + explanation. 404 if the
 * item doesn't exist or belongs to a different account. */
export async function getPortfolioItemAnalysis(
  id: string,
  accessToken: string,
  signal?: AbortSignal,
): Promise<PortfolioItemAnalysis> {
  return apiCall<PortfolioItemAnalysis>(
    "GET",
    `/api/portfolio/items/${id}/analysis`,
    { bearerToken: accessToken, signal },
  );
}

/** `POST /api/portfolio/items/{id}/analysis/retry` — re-queues an item for
 * AI analysis. Returns `202` with `{ portfolioItemId, newJobId }` on success
 * (only valid when the current status is `Failed`); throws an `ApiError` with
 * `errorCode: "portfolio_analysis_not_retryable"` and `status: 409` if the
 * item is in any other status, and `404` if the item doesn't exist or isn't
 * the caller's. No request body. */
export async function retryPortfolioItemAnalysis(
  id: string,
  accessToken: string,
): Promise<{ portfolioItemId: string; newJobId: string }> {
  return apiCall<{ portfolioItemId: string; newJobId: string }>(
    "POST",
    `/api/portfolio/items/${id}/analysis/retry`,
    { bearerToken: accessToken },
  );
}

/** `PUT /api/portfolio/items/{id}/sharing` — flips the per-item
 * `shareOriginalWithEmployers` flag for the signed-in student. Body is
 * `{ shareOriginal: boolean }`. Returns 200 with the updated
 * `PortfolioItemResponse` (same shape as a list entry, including the new
 * flag value) on success. Throws an `ApiError` carrying the backend's
 * `errorCode`/`status` for non-2xx responses — `404` for an unknown item,
 * `401` when unauthenticated, `403` for non-Students. The `signal` is
 * forwarded to `apiCall` so the caller can cancel an in-flight toggle if
 * the student unmounts the page or starts another toggle. */
export async function updateItemSharing(
  bearerToken: string,
  id: string,
  shareOriginal: boolean,
  signal?: AbortSignal,
): Promise<PortfolioItem> {
  return apiCall<PortfolioItem>(
    "PUT",
    `/api/portfolio/items/${id}/sharing`,
    {
      bearerToken,
      signal,
      body: { shareOriginal },
    },
  );
}
