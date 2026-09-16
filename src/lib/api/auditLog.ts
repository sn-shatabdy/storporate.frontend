import { apiCall } from "./client";
import type { PagedResult } from "./pagination";

/**
 * Mirrors `Storporate.Modules.SecurityGovernance.AuditLogEntryResponse`.
 * Server omits `Hash`/`PreviousHash` (kept in the DB for the STOR-45 Integrity
 * Layer but not meaningful to a human reader), so the client shape is the
 * eleven visible fields only.
 */
export interface AuditLogEntry {
  id: string;
  sequenceNumber: number;
  accountId: string | null;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadataJson: string | null;
  createdAt: string;
}

/**
 * Filter shape for `GET /api/security-governance/audit-log`. Every field is
 * optional — a request with an empty filters object returns the most-recent
 * unfiltered page (matching the backend's `ListAuditLogEntriesRequest`).
 */
export interface AuditLogFilters {
  action?: string | null;
  resourceType?: string | null;
  accountId?: string | null;
  actorUserId?: string | null;
  /** ISO date (UTC) — inclusive lower bound on `createdAt`. */
  fromDate?: string | null;
  /** ISO date (UTC) — inclusive upper bound on `createdAt`. */
  toDate?: string | null;
}

/**
 * Fetches a single page of audit-log entries for the Administrator-only
 * `GET /api/security-governance/audit-log` endpoint. `accessToken` must be a
 * valid backend JWT bearer (the page guard redirects non-Administrators away
 * before this call ever fires, but the endpoint's own `[RequirePermission]`
 * gate is the real authorization check).
 */
export async function listAuditLogEntries(
  filters: AuditLogFilters,
  pageNumber: number,
  pageSize: number,
  accessToken: string,
  signal?: AbortSignal,
): Promise<PagedResult<AuditLogEntry>> {
  const params = new URLSearchParams();
  params.set("pageNumber", String(pageNumber));
  params.set("pageSize", String(pageSize));
  params.set("sortBy", "createdAt");
  params.set("sortDescending", "true");
  if (filters.action) params.set("action", filters.action);
  if (filters.resourceType) params.set("resourceType", filters.resourceType);
  if (filters.accountId) params.set("accountId", filters.accountId);
  if (filters.actorUserId) params.set("actorUserId", filters.actorUserId);
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);

  return apiCall<PagedResult<AuditLogEntry>>(
    "GET",
    `/api/security-governance/audit-log?${params.toString()}`,
    { bearerToken: accessToken, signal },
  );
}
