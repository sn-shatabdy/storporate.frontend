"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertOctagon,
  Inbox,
  RefreshCw,
  Search,
  Shield,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ActionPill } from "@/components/admin/action-pill";
import { PaginationBar } from "@/components/admin/pagination-bar";
import {
  listAuditLogEntries,
  type AuditLogEntry,
} from "@/lib/api/auditLog";
import type { PagedResult } from "@/lib/api/pagination";
import { rowTintFor, severityForAction, truncateGuid } from "@/lib/admin/severity";

const PAGE_SIZE = 20;

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "login_succeeded", label: "login_succeeded" },
  { value: "google_login_succeeded", label: "google_login_succeeded" },
  { value: "token_refreshed", label: "token_refreshed" },
  { value: "session_revoked", label: "session_revoked" },
  { value: "all_sessions_revoked", label: "all_sessions_revoked" },
  { value: "otp_requested", label: "otp_requested" },
  { value: "otp_verify_failed", label: "otp_verify_failed" },
  { value: "otp_locked", label: "otp_locked" },
  { value: "google_login_failed", label: "google_login_failed" },
  { value: "token_refresh_failed", label: "token_refresh_failed" },
  { value: "refresh_token_reused", label: "refresh_token_reused" },
  { value: "permission_denied", label: "permission_denied" },
  { value: "google_login_rejected_unverified_email", label: "google_login_rejected_unverified_email" },
];

const RESOURCE_OPTIONS = [
  { value: "", label: "All resources" },
  { value: "Session", label: "Session" },
  { value: "User", label: "User" },
  { value: "Permission", label: "Permission" },
];

type PageState =
  | { status: "loading" }
  | { status: "success"; result: PagedResult<AuditLogEntry> }
  | { status: "error"; message: string };

function formatTimestamp(iso: string): string {
  // Hand-rolled UTC formatter — keeps the column monospace-clean without
  // depending on `Intl.DateTimeFormat`'s locale-dependent output (which
  // would break the column alignment across browsers).
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
  );
}

function summaryLabel(result: PagedResult<AuditLogEntry>): string {
  if (result.totalCount === 0) return "Showing 0 of 0 entries";
  const from = (result.pageNumber - 1) * result.pageSize + 1;
  const to = Math.min(result.pageNumber * result.pageSize, result.totalCount);
  return `Showing ${from}–${to} of ${result.totalCount} entries`;
}

export default function AuditLogPage() {
  const { data: session } = useSession();

  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [pageNumber, setPageNumber] = useState(1);

  // The applied filters — separate from the form values so clicking "Apply"
  // (not just changing a select) advances the page, matching the
  // date-range UX pattern from classic admin dashboards. `pendingFilters`
  // holds the in-flight form state.
  const [appliedFilters, setAppliedFilters] = useState({
    action: "",
    resourceType: "",
    fromDate: "",
    toDate: "",
  });

  const [state, setState] = useState<PageState>({ status: "loading" });

  const accessToken = session?.accessToken;

  const fetchEntries = useCallback(
    async (signal?: AbortSignal) => {
      if (!accessToken) return;
      setState({ status: "loading" });
      try {
        const result = await listAuditLogEntries(
          {
            action: appliedFilters.action || null,
            resourceType: appliedFilters.resourceType || null,
            fromDate: appliedFilters.fromDate ? new Date(appliedFilters.fromDate).toISOString() : null,
            toDate: appliedFilters.toDate ? new Date(appliedFilters.toDate).toISOString() : null,
          },
          pageNumber,
          PAGE_SIZE,
          accessToken,
          signal,
        );
        if (signal?.aborted) return;
        setState({ status: "success", result });
      } catch (error) {
        if (signal?.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },
    [accessToken, appliedFilters, pageNumber],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchEntries(controller.signal);
    return () => controller.abort();
  }, [fetchEntries]);

  function handleApplyFilters(event: React.FormEvent) {
    event.preventDefault();
    setPageNumber(1);
    setAppliedFilters({ action, resourceType, fromDate, toDate });
  }

  function handleClearFilters() {
    setAction("");
    setResourceType("");
    setFromDate("");
    setToDate("");
    setPageNumber(1);
    setAppliedFilters({ action: "", resourceType: "", fromDate: "", toDate: "" });
  }

  const isError = state.status === "error";

  return (
    <div className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"
            >
              <Shield className="size-5" />
            </span>
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Audit Log
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Tamper-evident record of authentication, session, and access-control events.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground sm:self-center">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            Administrator view
          </span>
        </header>

        <form
          onSubmit={handleApplyFilters}
          className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="audit-action" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Action
              </label>
              <select
                id="audit-action"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="audit-resource" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Resource Type
              </label>
              <select
                id="audit-resource"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                {RESOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="audit-from" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                From
              </label>
              <input
                id="audit-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="audit-to" className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                To
              </label>
              <input
                id="audit-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleClearFilters}>
              <X className="size-3.5" />
              Clear
            </Button>
            <Button type="submit" size="sm">
              <Search className="size-3.5" />
              Apply filters
            </Button>
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          {state.status === "loading" && <LoadingSkeleton />}

          {state.status === "success" && state.result.items.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-6 py-3">Time</th>
                      <th scope="col" className="px-6 py-3">Action</th>
                      <th scope="col" className="px-6 py-3">Resource</th>
                      <th scope="col" className="px-6 py-3">Actor</th>
                      <th scope="col" className="px-6 py-3">Account</th>
                      <th scope="col" className="px-6 py-3">IP address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {state.result.items.map((entry) => {
                      const severity = severityForAction(entry.action);
                      return (
                        <tr key={entry.id} className={`${rowTintFor(severity)} text-foreground`}>
                          <td className="whitespace-nowrap px-6 py-3 font-mono text-xs text-muted-foreground">
                            {formatTimestamp(entry.createdAt)}
                          </td>
                          <td className="px-6 py-3">
                            <ActionPill action={entry.action} severity={severity} />
                          </td>
                          <td className="px-6 py-3">
                            <span className="font-medium">{entry.resourceType}</span>
                            {entry.resourceId && (
                              <span className="ml-2 font-mono text-xs text-muted-foreground">
                                {truncateGuid(entry.resourceId)}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 font-mono text-xs text-muted-foreground">
                            {entry.actorUserId ? truncateGuid(entry.actorUserId) : "—"}
                          </td>
                          <td className="px-6 py-3 font-mono text-xs text-muted-foreground">
                            {entry.accountId ? truncateGuid(entry.accountId) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-6 py-3 font-mono text-xs text-muted-foreground">
                            {entry.ipAddress ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationBar
                pageNumber={state.result.pageNumber}
                totalPages={state.result.totalPages}
                hasPrevious={state.result.hasPrevious}
                hasNext={state.result.hasNext}
                onPageChange={setPageNumber}
                summaryLabel={summaryLabel(state.result)}
              />
            </>
          )}

          {state.status === "success" && state.result.items.length === 0 && (
            <EmptyState onClear={handleClearFilters} />
          )}

          {isError && (
            <ErrorState
              message={state.message}
              onRetry={() => void fetchEntries()}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="divide-y divide-border" aria-label="Loading audit log entries">
      <div className="grid grid-cols-12 gap-3 bg-muted/40 px-6 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="col-span-2">Time</span>
        <span className="col-span-3">Action</span>
        <span className="col-span-3">Resource</span>
        <span className="col-span-2">Actor</span>
        <span className="col-span-2">IP address</span>
      </div>
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={idx} className="grid grid-cols-12 gap-3 px-6 py-4">
          <span className="col-span-2 h-3 animate-pulse rounded bg-muted" style={{ width: `${60 + (idx % 3) * 10}%` }} />
          <span className="col-span-3 h-3 animate-pulse rounded bg-muted" style={{ width: `${40 + (idx % 4) * 12}%` }} />
          <span className="col-span-3 h-3 animate-pulse rounded bg-muted" style={{ width: `${50 + (idx % 3) * 10}%` }} />
          <span className="col-span-2 h-3 animate-pulse rounded bg-muted" style={{ width: `${40 + (idx % 2) * 15}%` }} />
          <span className="col-span-2 h-3 animate-pulse rounded bg-muted" style={{ width: `${30 + (idx % 5) * 10}%` }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Inbox className="size-5" />
      </span>
      <h2 className="font-heading text-lg font-semibold text-foreground">No matching entries</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Try widening your filters to see more audit-log entries.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onClear}>
        <X className="size-3.5" />
        Clear filters
      </Button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full"
        style={{ backgroundColor: "#FBE9E7", color: "#B3261E" }}
      >
        <AlertOctagon className="size-5" />
      </span>
      <h2 className="font-heading text-lg font-semibold text-foreground">
        Couldn&apos;t load the audit log
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        We couldn&apos;t reach the backend just now. Check your connection or the API status, then try again.
      </p>
      <p className="max-w-md text-xs text-muted-foreground/80 font-mono">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Retry
      </Button>
    </div>
  );
}
