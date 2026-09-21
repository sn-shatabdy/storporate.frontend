import type { JobPosting, JobWithFit } from "@/lib/api/jobPostings";

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
    ...overrides,
  };
}
