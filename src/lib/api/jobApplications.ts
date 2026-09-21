import { apiCall } from "./client";
import type {
  ApplicationStatus,
  FitLabel,
  JobFit,
  PostingKind,
} from "./jobPostings";

/**
 * STOR-67 student applications client.
 *
 * Students apply with their profile (no CV) and follow each application's
 * status. Organizations review applicants with the same fit explanation.
 * Wire values are camelCase. Errors are `ApiError` with `errorCode`:
 *   - `job_posting_not_found` (404)
 *   - `job_posting_deadline_passed` (409, STOR-66-inherited)
 *   - `application_not_found` (404)
 *   - `application_already_submitted` (409)
 *   - `application_conflict` (409, optimistic-concurrency miss)
 *   - `application_display_name_required` (400, student has no profile name)
 *   - `application_display_name_invalid` (400)
 */

export interface ApplicationResponse {
  id: string;
  jobPostingId: string;
  jobTitle: string;
  companyName: string;
  kind: PostingKind;
  status: ApplicationStatus;
  createdAt: string;
  statusChangedAt: string;
  fitLabel: FitLabel;
}

/**
 * Body of `GET /api/discovery/applications`: one paged slice of the
 * caller's own applications (newest first, capped on the server). Mirrors
 * the STOR-66-era `JobBrowsePage` envelope (`items`/`page`/`pageSize`/`total`)
 * so the same "Load more" paging code can drive both lists.
 */
export interface ApplicationListResponse {
  items: ApplicationResponse[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApplicantSkill {
  name: string;
  band: "Strong" | "Developing";
}

export interface ApplicantItem {
  label: string;
  category: string;
  skills: ApplicantSkill[];
}

export interface ApplicantResponse {
  id: string;
  status: ApplicationStatus;
  createdAt: string;
  statusChangedAt: string;
  displayName: string;
  headline: string | null;
  university: string | null;
  fieldOfStudy: string | null;
  studyYear: number | null;
  items: ApplicantItem[];
  fit: JobFit;
}

/**
 * Body of `GET /api/discovery/job-postings/{id}/applications`: one paged
 * slice of the posting's applicants (newest first, capped on the server).
 */
export interface ApplicantListResponse {
  items: ApplicantResponse[];
  page: number;
  pageSize: number;
  total: number;
}

/** Statuses an employer can set. */
export type ApplicantDecision = "Shortlisted" | "NotSelected";

/** Student: apply to an Open posting. The name is sent only when asked for. */
export async function applyToJob(
  bearerToken: string,
  jobId: string,
  displayName?: string,
  signal?: AbortSignal,
): Promise<ApplicationResponse> {
  const name = displayName?.trim();
  return apiCall(
    "POST",
    `/api/discovery/jobs/${encodeURIComponent(jobId)}/applications`,
    {
      bearerToken,
      signal,
      body: name ? { displayName: name } : {},
    },
  );
}

/**
 * Student: every application the caller has submitted, paged. `page`
 * defaults to 1 and `pageSize` defaults to the server cap; pass either via
 * `opts` to load the next slice for a "Load more" control.
 */
export async function listMyApplications(
  bearerToken: string,
  signal?: AbortSignal,
  opts: { page?: number; pageSize?: number } = {},
): Promise<ApplicationListResponse> {
  const params = new URLSearchParams();
  if (typeof opts.page === "number" && opts.page > 0) {
    params.set("page", String(opts.page));
  }
  if (typeof opts.pageSize === "number" && opts.pageSize > 0) {
    params.set("pageSize", String(opts.pageSize));
  }
  const query = params.toString();
  return apiCall(
    "GET",
    query ? `/api/discovery/applications?${query}` : "/api/discovery/applications",
    { bearerToken, signal },
  );
}

function applicantsBase(postingId: string): string {
  return `/api/discovery/job-postings/${encodeURIComponent(postingId)}/applications`;
}

/**
 * Employer: applicants for one own posting, paged. Same envelope as
 * `listMyApplications` for symmetry.
 */
export async function listApplicants(
  bearerToken: string,
  postingId: string,
  signal?: AbortSignal,
  opts: { page?: number; pageSize?: number } = {},
): Promise<ApplicantListResponse> {
  const params = new URLSearchParams();
  if (typeof opts.page === "number" && opts.page > 0) {
    params.set("page", String(opts.page));
  }
  if (typeof opts.pageSize === "number" && opts.pageSize > 0) {
    params.set("pageSize", String(opts.pageSize));
  }
  const query = params.toString();
  return apiCall(
    "GET",
    query ? `${applicantsBase(postingId)}?${query}` : applicantsBase(postingId),
    { bearerToken, signal },
  );
}

/** Employer: one applicant. The server marks Submitted as Viewed. */
export async function getApplicant(
  bearerToken: string,
  postingId: string,
  applicationId: string,
  signal?: AbortSignal,
): Promise<ApplicantResponse> {
  return apiCall(
    "GET",
    `${applicantsBase(postingId)}/${encodeURIComponent(applicationId)}`,
    { bearerToken, signal },
  );
}

/** Employer: shortlist or decline an applicant. */
export async function setApplicantStatus(
  bearerToken: string,
  postingId: string,
  applicationId: string,
  status: ApplicantDecision,
  signal?: AbortSignal,
): Promise<ApplicantResponse> {
  return apiCall(
    "POST",
    `${applicantsBase(postingId)}/${encodeURIComponent(applicationId)}/status`,
    { bearerToken, signal, body: { status } },
  );
}