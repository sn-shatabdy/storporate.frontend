/** Small formatting helpers shared by the outreach surfaces. */

/** "Sep 20" this year, "Sep 20, 2025" otherwise. Empty for bad input. */
export function formatShortDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "Sep 20, 10:00 AM" for a message timestamp. */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date}, ${time}`;
}

/** Key used to remember the organization name an employer last typed. */
export const ORGANIZATION_NAME_STORAGE_KEY = "storporate.outreach.organizationName";

export function readRememberedOrganization(): string {
  try {
    return window.localStorage.getItem(ORGANIZATION_NAME_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberOrganization(name: string): void {
  try {
    window.localStorage.setItem(ORGANIZATION_NAME_STORAGE_KEY, name);
  } catch {
    // Storage can be blocked. The field still works without it.
  }
}
