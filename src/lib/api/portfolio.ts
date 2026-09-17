import { apiCall, getApiBaseUrl, throwForErrorResponse } from "./client";
import type { PagedResult } from "./pagination";

/**
 * Condensed AI-derived skill preview for a single portfolio item — mirrors
 * `Storporate.Modules.Portfolio.PortfolioSkillPreview` on the wire (skillName
 * + confidenceBand only, no explanation). Sits next to the full
 * {@link PortfolioSkillFinding} which is what
 * `GET /api/portfolio/items/{id}/analysis` returns and what the detail page
 * renders. Same literal-union `confidenceBand` so the same
 * `styleForConfidenceBand` map drives both call sites.
 */
export interface PortfolioSkillPreview {
  skillName: string;
  confidenceBand: "Strong" | "Developing" | "Missing";
}

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
  // skill breakdown lives at `GET /api/portfolio/items/{id}/analysis` (see
  // `getPortfolioItemAnalysis` below).
  analysisStatus:
    | "NotAnalyzed"
    | "Analyzing"
    | "Analyzed"
    | "Failed"
    | "Unsupported";
  lastAnalyzedAt: string | null;
  // STOR-39: condensed skill preview surfaced on the timeline row so a
  // student can see at a glance which skills the AI identified for this
  // item — without paying the N+1 cost of calling the per-item analysis
  // endpoint for every entry. The backend co-fetches these in a single
  // bulk query against `PortfolioSkillFindings`, scoped to this page's
  // item ids only. Always an array (never null) — empty for not-yet-
  // analyzed items. Explanations stay on the detail page.
  skills: PortfolioSkillPreview[];
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
