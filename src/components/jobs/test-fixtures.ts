import type { JobPosting, JobWithFit } from "@/lib/api/jobPostings";
import type {
  ApplicantResponse,
  ApplicationResponse,
} from "@/lib/api/jobApplications";

export const ACCESS_TOKEN = "test-token";

export function makePosting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: "job-1",
    title: "Junior data analyst",
    kind: "Job",
    companyName: "Acme Analytics",
    location: "Dhaka",
    workMode: "Hybrid",
    description: "Build dashboards and clean sales data for the team.",
    requiredSkills: ["Power BI", "Excel", "SQL"],
    status: "Open",
    createdAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-20T10:00:00Z",
    ...overrides,
  };
}

export function makeJob(
  overrides: Partial<JobWithFit> = {},
): JobWithFit {
  return {
    ...makePosting(),
    fit: {
      label: "Good match",
      matched: [
        { name: "Power BI", band: "Strong" },
        { name: "Excel", band: "Developing" },
      ],
      missing: ["SQL"],
    },
    application: null,
    ...overrides,
  };
}

export function makeApplication(
  overrides: Partial<ApplicationResponse> = {},
): ApplicationResponse {
  return {
    id: "app-1",
    jobPostingId: "job-1",
    jobTitle: "Junior data analyst",
    companyName: "Acme Analytics",
    kind: "Job",
    status: "Submitted",
    createdAt: "2026-09-20T10:00:00Z",
    statusChangedAt: "2026-09-20T10:00:00Z",
    fitLabel: "Good match",
    ...overrides,
  };
}

export function makeApplicant(
  overrides: Partial<ApplicantResponse> = {},
): ApplicantResponse {
  return {
    id: "app-1",
    status: "Submitted",
    createdAt: "2026-09-20T10:00:00Z",
    statusChangedAt: "2026-09-20T10:00:00Z",
    displayName: "Nadia Rahman",
    headline: "Data student who builds dashboards",
    university: "BUET",
    fieldOfStudy: "Computer Science",
    studyYear: 3,
    items: [
      {
        label: "Sales dashboard",
        category: "Project",
        skills: [
          { name: "Power BI", band: "Strong" },
          { name: "Excel", band: "Developing" },
        ],
      },
    ],
    fit: {
      label: "Good match",
      matched: [
        { name: "Power BI", band: "Strong" },
        { name: "Excel", band: "Developing" },
      ],
      missing: ["SQL"],
    },
    ...overrides,
  };
}
