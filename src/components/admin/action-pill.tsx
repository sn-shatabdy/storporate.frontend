import type { AuditActionSeverity } from "@/lib/admin/severity";

/**
 * Tiny inline component so the table body can render an action's
 * severity-tinted pill without repeating three Tailwind classes inline at
 * every row. Colors are deliberately inline-style (not Tailwind classes) so
 * they survive the upcoming dark-mode/theme tweaks without needing an
 * extra `dark:` variant for every state — the same approach used on
 * /account's "Verified" pill.
 */
const SEVERITY_STYLES: Record<AuditActionSeverity, { background: string; color: string; label: string }> = {
  success: { background: "#E6F4EA", color: "#1E7B34", label: "Success" },
  warning: { background: "#FBEEE7", color: "#A4460F", label: "Warning" },
  critical: { background: "#FBE9E7", color: "#B3261E", label: "Critical" },
  neutral: { background: "var(--muted)", color: "var(--muted-foreground)", label: "Info" },
};

export function ActionPill({ action, severity }: { action: string; severity: AuditActionSeverity }) {
  const style = SEVERITY_STYLES[severity];
  return (
    <span
      aria-label={`${style.label}: ${action}`}
      title={action}
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: style.background, color: style.color }}
    >
      {action}
    </span>
  );
}
