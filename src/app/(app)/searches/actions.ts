"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRunner } from "@/lib/auth-run";
import { createAdminClient } from "@/lib/supabase/admin";
import { startSearch, pollSearch } from "@/lib/search-engine";
import { enrichSearch } from "@/lib/str/enrich";
import type { ActorConfig } from "@/lib/types";

const RunSchema = z.object({
  actorConfigId: z.string().uuid("Choose a data source"),
  name: z.string().trim().optional(),
  maxItems: z.number().int().min(1).max(2000),
  credentialId: z.string().uuid().optional().nullable(),
  // userParams arrives as a JSON string of { fieldKey: value }.
  params: z.string(),
});

export type RunState =
  | { error?: string; success?: string; searchId?: string; credentialLabel?: string }
  | undefined;

export async function runSearch(
  _prev: RunState,
  formData: FormData,
): Promise<RunState> {
  const profile = await requireRunner();

  const credentialIdRaw = formData.get("credentialId");
  const parsed = RunSchema.safeParse({
    actorConfigId: formData.get("actorConfigId"),
    name: formData.get("name") || undefined,
    maxItems: Number(formData.get("maxItems")),
    credentialId:
      credentialIdRaw && String(credentialIdRaw) !== "auto"
        ? String(credentialIdRaw)
        : null,
    params: formData.get("params") ?? "{}",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  let userParams: Record<string, unknown>;
  try {
    userParams = JSON.parse(parsed.data.params);
  } catch {
    return { error: "Invalid search parameters." };
  }
  // Persist maxItems with the params so re-runs reuse the same cap.
  userParams.__maxItems = parsed.data.maxItems;

  const admin = createAdminClient();
  const { data: configRow } = await admin
    .from("actor_configs")
    .select("*")
    .eq("id", parsed.data.actorConfigId)
    .single();

  const config = configRow as ActorConfig | null;
  if (!config || !config.active) {
    return { error: "Data source not found or inactive." };
  }

  // For url-mode Zillow configs, enforce the searchQueryState requirement.
  if (config.input_mode === "url") {
    const url = String(userParams.url ?? "");
    if (!url.includes("searchQueryState=")) {
      return {
        error:
          "The Zillow URL must contain '?searchQueryState='. Apply filters on Zillow and copy the URL.",
      };
    }
  }

  const result = await startSearch({
    config,
    userParams,
    maxItems: parsed.data.maxItems,
    name: parsed.data.name ?? null,
    createdBy: profile.id,
    forceCredentialId: parsed.data.credentialId,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/searches");
  return {
    success: "Search started.",
    searchId: result.searchId,
    credentialLabel: result.credentialLabel,
  };
}

// Re-run an existing saved search with the same params.
export async function rerunSearch(formData: FormData): Promise<void> {
  const profile = await requireRunner();
  const searchId = String(formData.get("search_id") ?? "");
  if (!searchId) return;

  const admin = createAdminClient();
  const { data: prev } = await admin
    .from("searches")
    .select("*")
    .eq("id", searchId)
    .single();

  if (!prev) return;

  const { data: configRow } = await admin
    .from("actor_configs")
    .select("*")
    .eq("id", prev.actor_config_id)
    .single();
  const config = configRow as ActorConfig | null;
  if (!config) return;

  const maxItems = Number(
    (prev.input_params as Record<string, unknown>)?.__maxItems ?? 100,
  );

  await startSearch({
    config,
    userParams: prev.input_params as Record<string, unknown>,
    maxItems: Number.isFinite(maxItems) ? maxItems : 100,
    name: prev.name,
    createdBy: profile.id,
    forceCredentialId: prev.credential_id,
  });

  revalidatePath("/searches");
}

// Manually poll a search (used by the status UI fallback / re-run page).
export async function pollSearchAction(searchId: string) {
  await requireRunner();
  return pollSearch(searchId);
}

// Enrich a search's results with an STR provider.
export async function enrichSearchAction(
  _prev: RunState,
  formData: FormData,
): Promise<RunState> {
  await requireRunner();
  const searchId = String(formData.get("search_id") ?? "");
  const provider = String(formData.get("provider") ?? "apify_airbnb");
  if (!searchId) return { error: "Missing search." };

  const result = await enrichSearch({ searchId, provider });
  if (!result.ok) {
    return {
      error:
        result.needsCredential
          ? `${result.needsCredential} credential required. Add it under Credentials to enable this provider.`
          : result.error,
    };
  }

  revalidatePath("/results");
  revalidatePath("/searches");
  return {
    success: `Enriched ${result.enriched} listings (${result.cacheHits} area cache hits).`,
  };
}
