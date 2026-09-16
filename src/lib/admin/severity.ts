/**
 * Action → severity bucket for the audit-log table. The known buckets share
 * visual treatment with the green "Verified" pill on /account (#E6F4EA/
 * #1E7B34), the warm "warning" tone, and the destructive red (#FBE9E7/
 * #B3261E) used on the auth screens' inline error banners. Any unknown
 * action string falls into `neutral` so a new backend event surfaces as a
 * readable row rather than a crashed mapping.
 */

export type AuditActionSeverity = "success" | "warning" | "critical" | "neutral";

/**
 * Single source of truth for every action string emitted by `IAuditLogWriter`
 * callsites (STOR-63 Phases 1+2). A future Phase adding a new event only
 * needs to update this map (and the corresponding test). One map, no
 * three-set priority chain, no overlap surface.
 */
const ACTION_SEVERITY: Record<string, AuditActionSeverity> = {
  login_succeeded: "success",
  google_login_succeeded: "success",
  token_refreshed: "success",
  session_revoked: "success",
  all_sessions_revoked: "success",
  otp_requested: "success",
  otp_verify_failed: "warning",
  otp_locked: "warning",
  google_login_failed: "warning",
  token_refresh_failed: "warning",
  refresh_token_reused: "critical",
  permission_denied: "critical",
  google_login_rejected_unverified_email: "critical",
};

export function severityForAction(action: string): AuditActionSeverity {
  return ACTION_SEVERITY[action] ?? "neutral";
}

/**
 * Full-row tint per severity, kept here as the single source of truth for
 * which background fills the `<tr>`. Shares the warm-red `#FBE9E7` token
 * with the `ActionPill`'s "Critical" pill (in components/admin/action-pill)
 * so a future palette change only has to touch this map.
 */
const SEVERITY_ROW_TINT: Record<AuditActionSeverity, string> = {
  critical: "bg-[#FBE9E7]/40",
  success: "bg-card",
  warning: "bg-card",
  neutral: "bg-card",
};

export function rowTintFor(severity: AuditActionSeverity): string {
  return SEVERITY_ROW_TINT[severity];
}

/**
 * Truncates a GUID string to first-4 + last-4 hex chars joined by an
 * ellipsis. Returns the original string verbatim when it's shorter than
 * 8 chars (e.g. some backend identifier shapes). Null/undefined handling
 * lives at the call site — the formatter formats.
 */
export function truncateGuid(value: string): string {
  if (value.length < 8) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
