import { ApiError, MissingEnvVarError } from "./errors";

/**
 * Reads the backend base URL from the environment. Throws a clear, typed
 * error instead of letting a later `fetch` fail on an `undefined`/empty URL.
 */
export function getApiBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl || baseUrl.trim() === "") {
    throw new MissingEnvVarError("NEXT_PUBLIC_API_BASE_URL");
  }
  return baseUrl;
}

function buildUrl(path: string): string {
  return `${getApiBaseUrl()}${path}`;
}

async function throwForErrorResponse(response: Response): Promise<never> {
  const raw = await response.text();
  let parsed: { errorCode?: string; message?: string } = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    // Non-JSON error body (e.g. an upstream proxy error) — fall through
    // with the raw status text below.
  }
  throw new ApiError(
    parsed.errorCode ?? "unknown",
    parsed.message ?? `Request failed (${response.status})`,
    response.status,
  );
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Small typed fetch wrapper for the Storporate API. Reads
 * `NEXT_PUBLIC_API_BASE_URL` on every call (via {@link getApiBaseUrl}) so a
 * missing/misconfigured env var fails clearly rather than as a confusing
 * network error, and normalizes non-2xx responses into a typed {@link ApiError}
 * matching the backend's `{errorCode, message}` global exception handler shape.
 */
export async function apiCall<T = unknown>(
  method: HttpMethod,
  path: string,
  init?: { signal?: AbortSignal },
): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method,
    headers: { Accept: "application/json" },
    signal: init?.signal,
  });

  if (!response.ok) {
    return throwForErrorResponse(response);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
