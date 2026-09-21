import { apiCall } from "./client";

/**
 * STOR-66 job and internship postings client.
 *
 * Organization endpoints manage the caller's own postings; Student endpoints
 * browse Open postings with a per-student fit summary. Wire values are
 * camelCase. Errors are `ApiError` with `errorCode`:
 *   - `job_posting_not_found` (404)
 *   - `job_posting_closed` (409, Closed is final)
 *   - `job_posting_conflict` (409, optimistic concurrency)
 *   - `job_posting_deadline_invalid` (400)
 *   - `job_posting_openings_invalid` (400)
 *   - `job_posting_compensation_invalid` (400)
 *   - `job_posting_query_invalid` (400)
 *   - other 400 validation errors carry a readable `message`
 */

export type PostingKind = "Job" | "Internship";
export type WorkMode = "OnSite" | "Remote" | "Hybrid";
export type PostingStatus = "Open" | "Paused" | "Closed";

/** Pay range in whole Bangladeshi taka per month. Both bounds may be `null`
 *  when the employer does not record one. `visibleToStudents` decides
 *  whether students see the range on the opening card; employers always see
 *  their own values. */
export interface PostingCompensation {
  min: number | null;
  max: number | null;
  visibleToStudents: boolean;
}

/**
 * Employer-facing posting record. Phase 1 adds `applicationDeadline`
 * (yyyy-MM-dd), `openings`, `compensation` and `applicantCount`. Phase 1
 * also adds the server-computed `isExpired` flag, set when an Open posting
 * is past its deadline (students stop seeing it at read time).
 */
export interface JobPosting {
  id: string;
  title: string;
  kind: PostingKind;
  companyName: string;
  location: string | null;
  workMode: WorkMode;
  description: string;
  requiredSkills: string[];
  status: PostingStatus;
  createdAt: string;
  updatedAt: string;
  /** Optional date in `yyyy-MM-dd`. Optional for backward compatibility. */
  applicationDeadline?: string | null;
  /** Number of openings, default 1. Optional for backward compatibility. */
  openings?: number;
  /** Pay range. Optional for backward compatibility. */
  compensation?: PostingCompensation;
  /** Server-computed expiry flag for Open postings past their deadline. */
  isExpired?: boolean;
  /** Count of applicants shown on the employer card. */
  applicantCount?: number;
}

/**
 * Phase 1 request body for create and update. The new fields are additive
 * over the original payload — older clients that still send the old shape
 * keep working as long as the backend treats them as optional.
 */
export interface JobPostingRequest {
  title: string;
  kind: PostingKind;
  companyName: string;
  location: string | null;
  workMode: WorkMode;
  description: string;
  requiredSkills: string[];
  /** yyyy-MM-dd or null. Optional. */
  applicationDeadline?: string | null;
  /** Whole number 1..500. Optional; defaults to 1 server side. */
  openings?: number;
  /** Pay range. Optional; values are whole taka. */
  compensation?: PostingCompensation;
}

export interface PostingCounts {
  open: number;
  paused: number;
  closed: number;
  total: number;
}

export interface MyPostingsFilters {
  /** PostingStatus as a string; the page sends "Open"|"Paused"|"Closed" or
   *  omits `status` for All. */
  status?: PostingStatus;
  /** Free-text search; trimmed server side. Empty / undefined omits the
   *  parameter. */
  q?: string;
}

export type FitLabel = "Strong match" | "Good match" | "Early match" | "Not yet";

export interface FitMatchedSkill {
  name: string;
  band: "Strong" | "Developing";
}

export interface JobFit {
  label: FitLabel;
  matched: FitMatchedSkill[];
  missing: string[];
}

/** STOR-67: the caller's application to a posting, or null when none. */
export type ApplicationStatus =
  | "Submitted"
  | "Viewed"
  | "Shortlisted"
  | "NotSelected";

export interface JobApplicationRef {
  id: string;
  status: ApplicationStatus;
}

/**
 * Student-side record. Optional fields added in Phase 1 (deadline, openings,
 * compensation, isExpired, status) are surfaced here so the Phase 3 student
 * screens can read them without breaking compilation. Older API responses
 * without these keys still type-check (all fields are optional).
 */
export interface JobWithFit extends JobPosting {
  fit: JobFit;
  application: JobApplicationRef | null;
}

export interface JobFilters {
  kind?: PostingKind;
  workMode?: WorkMode;
  q?: string;
}

const BASE = "/api/discovery/job-postings";

function idPath(id: string): string {
  return `${BASE}/${encodeURIComponent(id)}`;
}

function appendQuery(path: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Employer: own postings, newest first. Phase 1 returns counts so the tab
 *  strip can render badges without a second request. */
export async function listMyPostings(
  bearerToken: string,
  filters: MyPostingsFilters = {},
  signal?: AbortSignal,
): Promise<{ items: JobPosting[]; counts: PostingCounts }> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  return apiCall("GET", appendQuery(BASE, params), { bearerToken, signal });
}

/** Employer: one own posting. */
export async function getMyPosting(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<JobPosting> {
  return apiCall("GET", idPath(id), { bearerToken, signal });
}

/** Employer: create a posting (201). */
export async function createPosting(
  bearerToken: string,
  body: JobPostingRequest,
  signal?: AbortSignal,
): Promise<JobPosting> {
  return apiCall("POST", BASE, { bearerToken, signal, body });
}

/** Employer: replace a posting. 409 `job_posting_closed` when Closed,
 *  409 `job_posting_conflict` on an optimistic-concurrency miss. */
export async function updatePosting(
  bearerToken: string,
  id: string,
  body: JobPostingRequest,
  signal?: AbortSignal,
): Promise<JobPosting> {
  return apiCall("PUT", idPath(id), { bearerToken, signal, body });
}

/** Employer: Open <-> Paused, Open or Paused -> Closed. Closed is final. */
export async function setPostingStatus(
  bearerToken: string,
  id: string,
  status: PostingStatus,
  signal?: AbortSignal,
): Promise<JobPosting> {
  return apiCall("POST", `${idPath(id)}/status`, {
    bearerToken,
    signal,
    body: { status },
  });
}

/** Student: Open postings with fit. Empty filters are left out of the URL. */
export async function listJobs(
  bearerToken: string,
  filters: JobFilters = {},
  signal?: AbortSignal,
): Promise<{ items: JobWithFit[] }> {
  const params = new URLSearchParams();
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.workMode) params.set("workMode", filters.workMode);
  const q = filters.q?.trim();
  if (q) params.set("q", q);
  return apiCall("GET", appendQuery("/api/discovery/jobs", params), {
    bearerToken,
    signal,
  });
}

/** Student: one Open posting with fit. */
export async function getJob(
  bearerToken: string,
  id: string,
  signal?: AbortSignal,
): Promise<JobWithFit> {
  return apiCall("GET", `/api/discovery/jobs/${encodeURIComponent(id)}`, {
    bearerToken,
    signal,
  });
}
