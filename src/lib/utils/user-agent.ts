/**
 * Small hand-rolled `User-Agent` parser for the account page's session list —
 * good enough for a human-readable "Chrome on macOS" style label and a
 * device-type icon choice, not exhaustive UA sniffing. Chosen over adding
 * `ua-parser-js` since simple substring matching covers the handful of
 * browser/OS combinations this needs (see the plan's explicit allowance for
 * either approach).
 */
export type DeviceKind = "mobile" | "desktop";

export interface ParsedUserAgent {
  label: string;
  deviceKind: DeviceKind;
}

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  if (!userAgent || userAgent.trim() === "") {
    return { label: "Unknown device", deviceKind: "desktop" };
  }

  const ua = userAgent;
  const isMobile = /Mobile|iPhone|iPod|Android/i.test(ua);

  let os = "an unknown OS";
  if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "an unknown browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/CriOS\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua) || /FxiOS\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";

  return {
    label: `${browser} on ${os}`,
    deviceKind: isMobile ? "mobile" : "desktop",
  };
}
