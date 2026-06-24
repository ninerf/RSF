import "server-only";

import { ApifyClient } from "apify-client";
import type { Provider, ProviderPollResult, ProviderRunHandle } from "./types";
import type { ActorConfig } from "@/lib/types";

// Apify provider: start a run async (never .call(), which blocks past Vercel's
// function timeout), then poll the run, and fetch dataset items on SUCCEEDED.
export const apifyProvider: Provider = {
  kind: "apify",

  async start({
    config,
    token,
    input,
    maxItems,
  }: {
    config: ActorConfig;
    token: string;
    input: Record<string, unknown>;
    maxItems: number;
  }): Promise<ProviderRunHandle> {
    const client = new ApifyClient({ token });
    // maxItems is a platform-level run option that caps charged dataset items
    // for pay-per-result actors (the zillow-scraper input schema has no
    // in-input limit field — confirmed from the live build schema).
    const run = await client
      .actor(config.actor_id)
      .start(input, { maxItems });
    return { runId: run.id };
  },

  async poll({
    token,
    runId,
  }: {
    config: ActorConfig;
    token: string;
    runId: string | null;
    handle?: ProviderRunHandle;
  }): Promise<ProviderPollResult> {
    if (!runId) return { status: "failed", error: "Missing Apify run id." };

    const client = new ApifyClient({ token });
    const run = await client.run(runId).get();

    if (!run) return { status: "failed", error: "Run not found." };

    switch (run.status) {
      case "READY":
      case "RUNNING":
      case "CREATED":
        return { status: "running" };
      case "SUCCEEDED": {
        const datasetId = run.defaultDatasetId;
        if (!datasetId) {
          return { status: "succeeded", items: [] };
        }
        const { items } = await client.dataset(datasetId).listItems();
        return {
          status: "succeeded",
          items: items as Record<string, unknown>[],
        };
      }
      case "FAILED":
        return { status: "failed", error: "Apify run failed." };
      case "TIMED-OUT":
        return { status: "failed", error: "Apify run timed out." };
      case "ABORTED":
        return { status: "aborted", error: "Apify run was aborted." };
      default:
        return { status: "running" };
    }
  },
};
