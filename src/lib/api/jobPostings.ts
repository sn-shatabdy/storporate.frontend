import { apiCall } from "./client";

/**
 * STOR-66 job and internship postings client.
 *
 * Organization endpoints manage the caller's own postings; Student endpoints
 * browse Open postings with a per-student fit summary. Wire values are
 * camelCase. Errors are `ApiError` with `errorCode`:
 *   - `job_posting_not_found` (404)
 *   - `job_posting_closed` (409, Closed is final)
 *   - 400 validation errors carry a readable `message`
 */

export type PostingKind = "Job" | "Internship";
export type WorkMode = "OnSite" | "Remote" | "Hybrid";
export type PostingStatus = "Open" | "Paused" | "Closed";

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
}

/** Body for create and update. */
export interface JobPostingRequest {
  title: string;
  kind: PostingKind;
  companyName: string;
  location: string | null;
  workMode: WorkMode;
  description: string;
  requiredSkills: string[];
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

export interface JobWithFit extends JobPosting {
  fit: JobFit;
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

/** Employer: own postings, newest first. */
export async function listMyPostings(
  bearerToken: string,
  signal?: AbortSignal,
): Promise<{ items: JobPosting[] }> {
  return apiCall("GET", BASE, { bearerToken, signal });
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

/** Employer: replace a posting. 409 `job_posting_closed` when Closed. */
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
  const qs = params.toString();
  return apiCall("GET", `/api/discovery/jobs${qs ? `?${qs}` : ""}`, {
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
