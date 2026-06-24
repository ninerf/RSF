import type { ActorConfig, ResultRow } from "@/lib/types";

// What a provider returns after a run completes (or starts, for async).
export interface ProviderRunHandle {
  // External run id (Apify run id). Null for synchronous http_api calls.
  runId: string | null;
  // For synchronous providers, items are available immediately.
  items?: Record<string, unknown>[];
}

export interface ProviderPollResult {
  status: "running" | "succeeded" | "failed" | "aborted";
  items?: Record<string, unknown>[];
  error?: string;
}

// Each provider kind implements start + poll. http_api providers resolve
// synchronously (poll returns the items captured at start).
export interface Provider {
  kind: "apify" | "http_api";
  start(args: {
    config: ActorConfig;
    token: string;
    input: Record<string, unknown>;
    maxItems: number;
  }): Promise<ProviderRunHandle>;
  poll(args: {
    config: ActorConfig;
    token: string;
    runId: string | null;
    handle?: ProviderRunHandle;
  }): Promise<ProviderPollResult>;
}

// Maps a raw provider item to a normalized results row using the config's
// result_mapping. Returns null if the item can't be mapped (e.g. no id).
export type ResultMapper = (
  item: Record<string, unknown>,
  config: ActorConfig,
) => Partial<ResultRow> | null;
