import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { selectCredential } from "@/lib/credentials";
import { checkBudget, recordUsage } from "@/lib/budget";
import { resolveProvider } from "@/lib/providers/registry";
import { buildInput } from "@/lib/providers/input-builder";
import { mapResult } from "@/lib/providers/result-mapper";
import type { ActorConfig, Search } from "@/lib/types";

export interface StartSearchResult {
  ok: boolean;
  searchId?: string;
  error?: string;
  credentialLabel?: string;
}

// Start a search: select credential, budget-guard, build input, start the
// provider run, persist apify_run_id + status. Never blocks on completion.
export async function startSearch(params: {
  config: ActorConfig;
  userParams: Record<string, unknown>;
  maxItems: number;
  name: string | null;
  createdBy: string;
  forceCredentialId?: string | null;
}): Promise<StartSearchResult> {
  const { config, userParams, maxItems, name, createdBy, forceCredentialId } =
    params;
  const admin = createAdminClient();

  const selection = await selectCredential(config.provider, forceCredentialId);
  if ("error" in selection) return { ok: false, error: selection.error };

  const { credential, token } = selection;

  // Worst-case charge = maxItems.
  const budget = await checkBudget(credential, maxItems);
  if (!budget.ok) return { ok: false, error: budget.reason };

  const input = buildInput(config, userParams);
  const provider = resolveProvider(config.provider);

  // Create the search row first so we always have a record.
  const { data: searchRow, error: insertErr } = await admin
    .from("searches")
    .insert({
      created_by: createdBy,
      actor_config_id: config.id,
      credential_id: credential.id,
      name,
      input_params: userParams,
      status: "pending",
    })
    .select("*")
    .single();

  if (insertErr || !searchRow) {
    return { ok: false, error: "Could not create the search record." };
  }

  const search = searchRow as Search;

  try {
    const handle = await provider.start({ config, token, input, maxItems });

    // For synchronous http_api providers, finalize immediately.
    if (handle.runId === null) {
      await finalizeFromItems({
        searchId: search.id,
        config,
        items: handle.items ?? [],
        credentialId: credential.id,
      });
    } else {
      await admin
        .from("searches")
        .update({ status: "running", apify_run_id: handle.runId })
        .eq("id", search.id);
    }

    return {
      ok: true,
      searchId: search.id,
      credentialLabel: credential.label,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Run failed to start.";
    await admin
      .from("searches")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("id", search.id);
    return { ok: false, error: message };
  }
}

// Poll a running search; on completion upsert results, record usage, update
// status. Safe to call repeatedly.
export async function pollSearch(searchId: string): Promise<Search> {
  const admin = createAdminClient();
  const { data: searchRow } = await admin
    .from("searches")
    .select("*")
    .eq("id", searchId)
    .single();

  const search = searchRow as Search;
  if (!search) throw new Error("Search not found.");
  if (search.status !== "running" && search.status !== "pending") {
    return search;
  }

  const { data: configRow } = await admin
    .from("actor_configs")
    .select("*")
    .eq("id", search.actor_config_id)
    .single();
  const config = configRow as ActorConfig;

  const selection = await selectCredential(config.provider, search.credential_id);
  if ("error" in selection) {
    await admin
      .from("searches")
      .update({ status: "failed", error: selection.error })
      .eq("id", searchId);
    return { ...search, status: "failed", error: selection.error };
  }

  const provider = resolveProvider(config.provider);
  const poll = await provider.poll({
    config,
    token: selection.token,
    runId: search.apify_run_id,
  });

  if (poll.status === "running") return search;

  if (poll.status === "failed" || poll.status === "aborted") {
    await admin
      .from("searches")
      .update({
        status: poll.status,
        error: poll.error ?? "Run did not succeed.",
        finished_at: new Date().toISOString(),
      })
      .eq("id", searchId);
    return { ...search, status: poll.status, error: poll.error ?? null };
  }

  // succeeded
  return finalizeFromItems({
    searchId,
    config,
    items: poll.items ?? [],
    credentialId: search.credential_id!,
  });
}

// Upsert mapped results, record usage, set status.
async function finalizeFromItems(params: {
  searchId: string;
  config: ActorConfig;
  items: Record<string, unknown>[];
  credentialId: string;
}): Promise<Search> {
  const { searchId, config, items, credentialId } = params;
  const admin = createAdminClient();

  const rows = items
    .map((item) => mapResult(item, config))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({ ...r, search_id: searchId }));

  if (rows.length > 0) {
    // Upsert on (source, external_id) to de-dupe across runs of the same area.
    await admin
      .from("results")
      .upsert(rows, { onConflict: "source,external_id" });
  }

  const resultCount = rows.length;
  const status = resultCount === 0 ? "failed" : "succeeded";
  const error = resultCount === 0 ? "Run produced no results." : null;

  await admin
    .from("searches")
    .update({
      status,
      result_count: resultCount,
      error,
      finished_at: new Date().toISOString(),
    })
    .eq("id", searchId);

  // Charge usage for what we actually got.
  if (resultCount > 0) {
    await recordUsage({ credentialId, searchId, resultsCharged: resultCount });
  }

  const { data } = await admin
    .from("searches")
    .select("*")
    .eq("id", searchId)
    .single();
  return data as Search;
}
