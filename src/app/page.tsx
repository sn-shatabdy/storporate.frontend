"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getApiBaseUrl } from "@/lib/api/client";
import { getLlmPing, type LlmPingResult } from "@/lib/api/diagnostics";
import { MissingEnvVarError } from "@/lib/api/errors";

type PingState =
  | { status: "loading" }
  | { status: "success"; result: LlmPingResult }
  | { status: "error"; message: string; detail?: string };

/**
 * Fetches the AI ping once on mount and renders the loading/success/error
 * state. The parent remounts this component (via a `key` change) to retry,
 * so every run starts from the natural "loading" initial state instead of a
 * synchronous `setState` inside the effect body.
 */
function PingCard({ onRetry }: { onRetry: () => void }) {
  const [state, setState] = useState<PingState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      let baseUrl: string;
      try {
        baseUrl = getApiBaseUrl();
      } catch (error) {
        setState({
          status: "error",
          message:
            error instanceof MissingEnvVarError
              ? error.message
              : "Unexpected configuration error.",
        });
        return;
      }

      try {
        const result = await getLlmPing(controller.signal);
        setState({ status: "success", result });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Unknown error";
        setState({
          status: "error",
          message: "Could not reach the Storporate API.",
          detail: `${message} — expected the backend at ${baseUrl}`,
        });
      }
    })();

    return () => controller.abort();
  }, []);

  return (
    <Card className="w-full max-w-xl shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cpu className="size-4" />
          </span>
          AI Model Ping
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          GET /api/diagnostics/llm-ping
        </CardDescription>
      </CardHeader>

      <CardContent>
        {state.status === "loading" && (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span>Waiting for a response from the AI model&hellip;</span>
          </div>
        )}

        {state.status === "success" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              Connected — live response received
            </div>

            <blockquote className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground">
              &ldquo;{state.result.outputText}&rdquo;
            </blockquote>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-secondary px-2.5 py-1 font-mono text-secondary-foreground">
                {state.result.modelUsed}
              </span>
              {state.result.usage?.totalTokens != null && (
                <span className="rounded-full border border-border px-2.5 py-1 text-muted-foreground">
                  {state.result.usage.totalTokens} tokens
                </span>
              )}
            </div>
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="size-4" />
              {state.message}
            </div>
            {state.detail && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {state.detail}
              </p>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              Make sure the backend is running (
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                dotnet run --project src/Storporate.Api
              </code>
              ) and Bionic has the model loaded.
            </p>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={state.status === "loading"}
        >
          <RefreshCw className="size-3.5" />
          Retry
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function Home() {
  const [attempt, setAttempt] = useState(0);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-gradient-to-b from-background to-muted/50 px-6 py-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          <Sparkles className="size-3.5" />
          Storporate Platform &middot; System Diagnostics
        </span>
        <h1 className="max-w-lg text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Backend Connectivity Check
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          This skeleton page confirms the frontend can reach the Storporate
          API and receive a real, live response from the local Bionic AI
          model.
        </p>
      </div>

      <PingCard key={attempt} onRetry={() => setAttempt((n) => n + 1)} />
    </div>
  );
}
