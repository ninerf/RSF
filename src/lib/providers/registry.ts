import "server-only";

import type { Provider } from "./types";
import { apifyProvider } from "./apify";
import { httpApiProvider } from "./http-api";

// Provider registry. A provider KIND is how we talk to a service (apify vs
// REST). The specific actor/endpoint, input shape, and output mapping all come
// from the actor_configs row — adding a data source never touches this file.
const REGISTRY: Record<string, Provider> = {
  apify: apifyProvider,
  http_api: httpApiProvider,
};

// Map an actor_config.provider string to a provider kind. Apify-based configs
// use provider 'apify'. REST configs (airdna, airroi, ...) use http_api.
const PROVIDER_KIND: Record<string, "apify" | "http_api"> = {
  apify: "apify",
  apify_airbnb: "apify",
  airdna: "http_api",
  airroi: "http_api",
  http_api: "http_api",
};

export function resolveProvider(providerName: string): Provider {
  const kind = PROVIDER_KIND[providerName] ?? "http_api";
  return REGISTRY[kind];
}
