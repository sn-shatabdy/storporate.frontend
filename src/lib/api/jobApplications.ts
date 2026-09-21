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
 *   - `application_not_found` (404)
 *   - `application_already_submitted` (409)
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

/** Student: every application the caller has submitted. */
export async function listMyApplications(
  bearerToken: string,
  signal?: AbortSignal,
): Promise<{ items: ApplicationResponse[] }> {
  return apiCall("GET", "/api/discovery/applications", { bearerToken, signal });
}

function applicantsBase(postingId: string): string {
  return `/api/discovery/job-postings/${encodeURIComponent(postingId)}/applications`;
}

/** Employer: applicants for one own posting. */
export async function listApplicants(
  bearerToken: string,
  postingId: string,
  signal?: AbortSignal,
): Promise<{ items: ApplicantResponse[] }> {
  return apiCall("GET", applicantsBase(postingId), { bearerToken, signal });
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
