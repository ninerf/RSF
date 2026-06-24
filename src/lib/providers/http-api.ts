import "server-only";

import type { Provider, ProviderPollResult, ProviderRunHandle } from "./types";
import type { ActorConfig } from "@/lib/types";

// Generic REST provider. The actor_config drives the request via its
// input_template, which may contain:
//   { "url": "...", "method": "GET|POST", "items_path": "data.results" }
// merged with the built input (the body/query). The bearer token comes from
// Vault. Items are captured synchronously at start; poll just returns them.
function getByPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );
}

export const httpApiProvider: Provider = {
  kind: "http_api",

  async start({
    config,
    token,
    input,
  }: {
    config: ActorConfig;
    token: string;
    input: Record<string, unknown>;
    maxItems: number;
  }): Promise<ProviderRunHandle> {
    const tpl = config.input_template ?? {};
    const url = String((tpl as Record<string, unknown>).url ?? "");
    const method = String(
      (tpl as Record<string, unknown>).method ?? "POST",
    ).toUpperCase();
    const itemsPath = String(
      (tpl as Record<string, unknown>).items_path ?? "",
    );

    if (!url) {
      throw new Error("http_api config requires a 'url' in input_template.");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const res = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(input),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${config.provider} endpoint.`);
    }

    const json = await res.json();
    const raw = itemsPath ? getByPath(json, itemsPath) : json;
    const items = Array.isArray(raw)
      ? (raw as Record<string, unknown>[])
      : [json as Record<string, unknown>];

    return { runId: null, items };
  },

  async poll({
    handle,
  }: {
    config: ActorConfig;
    token: string;
    runId: string | null;
    handle?: ProviderRunHandle;
  }): Promise<ProviderPollResult> {
    return { status: "succeeded", items: handle?.items ?? [] };
  },
};
