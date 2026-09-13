import { apiCall } from "./client";

/** Mirrors `Storporate.SharedKernel.Abstractions.LlmTokenUsage`. */
export interface LlmTokenUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

/** Mirrors `Storporate.SharedKernel.Abstractions.LlmCompletionResult`, as returned by
 * `GET /api/diagnostics/llm-ping`. */
export interface LlmPingResult {
  outputText: string;
  modelUsed: string;
  usage: LlmTokenUsage | null;
}

/**
 * Calls the backend's temporary AI diagnostics endpoint, which makes a real
 * round-trip to the local Bionic model and returns its response.
 */
export async function getLlmPing(signal?: AbortSignal): Promise<LlmPingResult> {
  return apiCall<LlmPingResult>("GET", "/api/diagnostics/llm-ping", { signal });
}
