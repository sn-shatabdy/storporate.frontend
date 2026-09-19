import type { PortfolioItem, PortfolioItemAnalysis } from "@/lib/api/portfolio";

/** The default wire-shape defaults for a portfolio-item fixture used by
 * the list-page and detail-page Vitest suites. Lives in its own file so
 * the two test files don't drift their defaults independently — the wire
 * contract is enforced in exactly one place, and a future rename of a
 * field surfaces here as a single TS compile error. */
const DEFAULT_ITEM_LABEL = "Capstone Project Writeup";
const DEFAULT_CREATED_AT = "2026-09-10T00:00:00Z";
const DEFAULT_LAST_ANALYZED_AT = "2026-09-10T00:05:00Z";

/** Builds a {@link PortfolioItem} fixture with sensible analysis defaults;
 * tests override the analysis-related fields + `skills` as needed. */
export function makePortfolioItem(
  overrides: Partial<PortfolioItem> = {},
): PortfolioItem {
  return {
    id: "item-001",
    label: DEFAULT_ITEM_LABEL,
    category: "Document",
    customCategoryText: null,
    submissionType: "File",
    originalFileName: "capstone.pdf",
    contentType: "application/pdf",
    fileSizeBytes: 1024 * 250,
    externalUrl: null,
    description: null,
    createdAt: DEFAULT_CREATED_AT,
    analysisStatus: "Analyzed",
    lastAnalyzedAt: DEFAULT_LAST_ANALYZED_AT,
    skills: [],
    ...overrides,
  };
}

/** Builds a {@link PortfolioItemAnalysis} fixture with sensible defaults. */
export function makePortfolioItemAnalysis(
  overrides: Partial<PortfolioItemAnalysis> = {},
): PortfolioItemAnalysis {
  return {
    status: "Analyzed",
    lastAnalyzedAt: DEFAULT_LAST_ANALYZED_AT,
    errorMessage: null,
    skills: [],
    ...overrides,
  };
}