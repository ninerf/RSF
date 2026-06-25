import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { selectCredential } from "@/lib/credentials";
import { checkBudget, recordUsage } from "@/lib/budget";
import { resolveProvider } from "@/lib/providers/registry";
import { buildInput } from "@/lib/providers/input-builder";
import { mapResult } from "@/lib/providers/result-mapper";
import { getCitiesForState, buildZillowCityUrl } from "@/lib/constants/us-cities";
import { getSettings } from "@/lib/budget";
import { logSearch } from "@/lib/search-logger";
import type { ActorConfig, Search } from "@/lib/types";

export interface StartSearchResult {
  ok: boolean;
  searchId?: string;
  error?: string;
  credentialLabel?: string;
}

export interface StartStateSearchResult {
  ok: boolean;
  searchId?: string;
  statesQueued?: number;
  error?: string;
  credentialLabel?: string;
}

// ─── State-based search ────────────────────────────────────────────────────

export async function startStateSearch(params: {
  config: ActorConfig;
  states: string[];
  maxPerState: number;
  minBeds?: number;
  maxRent?: number;
  ownerOnly: boolean;
  skipRecent: boolean;
  createdBy: string;
  forceCredentialId?: string | null;
}): Promise<StartStateSearchResult> {
  const {
    config, states, maxPerState, minBeds, maxRent,
    ownerOnly, skipRecent, createdBy, forceCredentialId,
  } = params;
  const admin = createAdminClient();

  const selection = await selectCredential(config.provider, forceCredentialId);
  if ("error" in selection) return { ok: false, error: selection.error };
  const { credential, token } = selection;

  // Determine which states to skip (recently searched).
  let statesToRun = [...states];
  if (skipRecent) {
    const settings = await getSettings();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - settings.skip_states_within_days);

    const { data: recentRuns } = await admin
      .from("search_state_runs")
      .select("state_code, finished_at")
      .eq("status", "succeeded")
      .gte("finished_at", cutoff.toISOString());

    const recentCodes = new Set(
      (recentRuns ?? []).map((r: { state_code: string }) => r.state_code),
    );
    statesToRun = statesToRun.filter((s) => !recentCodes.has(s));
  }

  if (statesToRun.length === 0) {
    return { ok: false, error: "All selected states were searched recently. Uncheck 'Skip states searched recently' or wait." };
  }

  // Prioritize: never-searched first, then oldest-searched first.
  const { data: lastRuns } = await admin
    .from("search_state_runs")
    .select("state_code, finished_at")
    .eq("status", "succeeded")
    .in("state_code", statesToRun)
    .order("finished_at", { ascending: false });

  const lastRunMap = new Map<string, string>();
  for (const r of (lastRuns ?? []) as { state_code: string; finished_at: string }[]) {
    if (!lastRunMap.has(r.state_code)) lastRunMap.set(r.state_code, r.finished_at);
  }

  statesToRun.sort((a, b) => {
    const aTime = lastRunMap.get(a);
    const bTime = lastRunMap.get(b);
    if (!aTime && !bTime) return 0;
    if (!aTime) return -1;
    if (!bTime) return 1;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });

  // Create the parent search row.
  const { data: searchRow, error: insertErr } = await admin
    .from("searches")
    .insert({
      created_by: createdBy,
      actor_config_id: config.id,
      credential_id: credential.id,
      name: `State search (${statesToRun.length} states)`,
      search_mode: "states",
      input_params: { states: statesToRun, maxPerState, minBeds, maxRent, ownerOnly },
      status: "running",
    })
    .select("*")
    .single();

  if (insertErr || !searchRow) {
    return { ok: false, error: "Could not create search record." };
  }

  const search = searchRow as Search;

  // Create sub-run rows.
  const subRows = statesToRun.map((code) => ({
    search_id: search.id,
    state_code: code,
    status: "pending" as const,
  }));

  // Also mark skipped states.
  const skippedStates = states.filter((s) => !statesToRun.includes(s));
  const skippedRows = skippedStates.map((code) => ({
    search_id: search.id,
    state_code: code,
    status: "skipped" as const,
    finished_at: new Date().toISOString(),
  }));

  await admin.from("search_state_runs").insert([...subRows, ...skippedRows]);

  await logSearch(search.id, "info", `Search started — ${statesToRun.length} states queued${skippedStates.length ? `, ${skippedStates.length} skipped (recent)` : ""}`);

  // Start the first state run (the rest will be picked up by polling).
  const firstState = statesToRun[0];
  await startSingleStateRun({
    searchId: search.id,
    stateCode: firstState,
    config,
    token,
    credential,
    maxPerState,
    minBeds,
    maxRent,
    ownerOnly,
  });

  return {
    ok: true,
    searchId: search.id,
    statesQueued: statesToRun.length,
    credentialLabel: credential.label,
  };
}

// Start one state sub-run. Searches all major cities in the state.
async function startSingleStateRun(params: {
  searchId: string;
  stateCode: string;
  config: ActorConfig;
  token: string;
  credential: { id: string };
  maxPerState: number;
  minBeds?: number;
  maxRent?: number;
  ownerOnly?: boolean;
}) {
  const { searchId, stateCode, config, token, credential, maxPerState, minBeds, maxRent, ownerOnly } = params;
  const admin = createAdminClient();

  const cities = getCitiesForState(stateCode);
  if (cities.length === 0) {
    await admin
      .from("search_state_runs")
      .update({ status: "failed", error: "No cities configured for this state.", finished_at: new Date().toISOString() })
      .eq("search_id", searchId)
      .eq("state_code", stateCode);
    return;
  }

  // Build search URLs for all cities in this state
  const searchUrls = cities.map((city) => ({
    url: buildZillowCityUrl(city, {
      minBeds: minBeds || undefined,
      maxPrice: maxRent || undefined,
      ownerOnly: ownerOnly || undefined,
    }),
  }));

  // Build the scraper input directly (multiple city URLs in one run)
  const input = {
    searchUrls,
    extractionMethod: "PAGINATION_WITH_ZOOM_IN",
  };

  const provider = resolveProvider(config.provider);

  // Budget check per state sub-run.
  const budget = await checkBudget(credential as any, maxPerState);
  if (!budget.ok) {
    await admin
      .from("search_state_runs")
      .update({ status: "failed", error: budget.reason, finished_at: new Date().toISOString() })
      .eq("search_id", searchId)
      .eq("state_code", stateCode);
    return;
  }

  await admin
    .from("search_state_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("search_id", searchId)
    .eq("state_code", stateCode);

  const cityNames = cities.map((c) => c.name).join(", ");
  await logSearch(searchId, "info", `Starting ${stateCode} (${cityNames})`, stateCode);

  try {
    const handle = await provider.start({ config, token, input, maxItems: maxPerState });

    if (handle.runId === null) {
      await finalizeStateRun({
        searchId,
        stateCode,
        config,
        items: handle.items ?? [],
        credentialId: credential.id,
      });
    } else {
      await admin
        .from("search_state_runs")
        .update({ apify_run_id: handle.runId })
        .eq("search_id", searchId)
        .eq("state_code", stateCode);
      await logSearch(searchId, "info", `Apify run ${handle.runId} started`, stateCode, { runId: handle.runId });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Run failed.";
    await logSearch(searchId, "error", `${stateCode} failed: ${message}`, stateCode);
    await admin
      .from("search_state_runs")
      .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
      .eq("search_id", searchId)
      .eq("state_code", stateCode);
  }
}

// Finalize a state sub-run: upsert results, advance to next state.
async function finalizeStateRun(params: {
  searchId: string;
  stateCode: string;
  config: ActorConfig;
  items: Record<string, unknown>[];
  credentialId: string;
}) {
  const { searchId, stateCode, config, items, credentialId } = params;
  const admin = createAdminClient();

  const rows = items
    .map((item) => mapResult(item, config))
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({ ...r, search_id: searchId }));

  let newCount = 0;
  if (rows.length > 0) {
    const { data: upserted } = await admin
      .from("results")
      .upsert(rows, { onConflict: "source,external_id", ignoreDuplicates: false })
      .select("id");
    newCount = upserted?.length ?? rows.length;
  }

  await admin
    .from("search_state_runs")
    .update({
      status: "succeeded",
      result_count: rows.length,
      new_result_count: newCount,
      finished_at: new Date().toISOString(),
    })
    .eq("search_id", searchId)
    .eq("state_code", stateCode);

  await logSearch(searchId, "info", `${stateCode} complete — ${rows.length} results (${newCount} new)`, stateCode, { resultCount: rows.length, newCount });

  if (rows.length > 0) {
    await recordUsage({ credentialId, searchId, resultsCharged: rows.length });
  }

  // Update parent search result count.
  const { data: allRuns } = await admin
    .from("search_state_runs")
    .select("status, result_count")
    .eq("search_id", searchId);

  const runs = (allRuns ?? []) as { status: string; result_count: number }[];
  const totalResults = runs.reduce((sum, r) => sum + r.result_count, 0);
  const allDone = runs.every((r) => ["succeeded", "failed", "skipped"].includes(r.status));

  await admin
    .from("searches")
    .update({
      result_count: totalResults,
      ...(allDone
        ? { status: "succeeded", finished_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", searchId);
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
// status. Safe to call repeatedly. For state-mode searches, also advances
// to the next pending state.
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

  // ─── State-mode: poll active sub-runs and advance ───
  if (search.search_mode === "states") {
    return pollStateSearch(search);
  }

  // ─── URL-mode (legacy) ───
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

// Poll state-mode search: check active sub-run, finalize if done, start next.
async function pollStateSearch(search: Search): Promise<Search> {
  const admin = createAdminClient();

  // Find the currently running sub-run.
  const { data: runningRuns } = await admin
    .from("search_state_runs")
    .select("*")
    .eq("search_id", search.id)
    .eq("status", "running")
    .limit(1);

  const activeRun = (runningRuns ?? [])[0] as
    | { id: string; state_code: string; apify_run_id: string | null }
    | undefined;

  if (!activeRun || !activeRun.apify_run_id) {
    // No active run — maybe start the next pending one.
    await advanceToNextState(search);
    const { data } = await admin.from("searches").select("*").eq("id", search.id).single();
    return data as Search;
  }

  // Poll the active sub-run's Apify job.
  const { data: configRow } = await admin
    .from("actor_configs")
    .select("*")
    .eq("id", search.actor_config_id)
    .single();
  const config = configRow as ActorConfig;

  const selection = await selectCredential(config.provider, search.credential_id);
  if ("error" in selection) return search;

  const provider = resolveProvider(config.provider);
  const poll = await provider.poll({
    config,
    token: selection.token,
    runId: activeRun.apify_run_id,
  });

  if (poll.status === "running") return search;

  if (poll.status === "failed" || poll.status === "aborted") {
    await admin
      .from("search_state_runs")
      .update({
        status: "failed",
        error: poll.error ?? "Run failed.",
        finished_at: new Date().toISOString(),
      })
      .eq("id", activeRun.id);
  } else {
    // succeeded — finalize this state run.
    await finalizeStateRun({
      searchId: search.id,
      stateCode: activeRun.state_code,
      config,
      items: poll.items ?? [],
      credentialId: search.credential_id!,
    });
  }

  // Advance to next state.
  await advanceToNextState(search);

  const { data } = await admin.from("searches").select("*").eq("id", search.id).single();
  return data as Search;
}

// Start the next pending state sub-run, or mark the parent as done.
async function advanceToNextState(search: Search) {
  const admin = createAdminClient();

  const { data: pendingRuns } = await admin
    .from("search_state_runs")
    .select("state_code")
    .eq("search_id", search.id)
    .eq("status", "pending")
    .limit(1);

  if (!pendingRuns || pendingRuns.length === 0) {
    // All done — finalize parent.
    const { data: allRuns } = await admin
      .from("search_state_runs")
      .select("status, result_count")
      .eq("search_id", search.id);

    const runs = (allRuns ?? []) as { status: string; result_count: number }[];
    const totalResults = runs.reduce((sum, r) => sum + r.result_count, 0);

    await admin
      .from("searches")
      .update({
        status: "succeeded",
        result_count: totalResults,
        finished_at: new Date().toISOString(),
      })
      .eq("id", search.id);

    const succeeded = runs.filter((r) => r.status === "succeeded").length;
    await logSearch(search.id, "info", `Search complete — ${totalResults} results across ${succeeded} states`);

    // Auto-enrich with STR revenue data
    try {
      const { enrichSearch } = await import("@/lib/str/enrich");
      await logSearch(search.id, "info", "Starting STR revenue enrichment...");
      const enrichResult = await enrichSearch({ searchId: search.id, provider: "apify_airbnb" });
      if (enrichResult.ok) {
        await logSearch(search.id, "info", `Enrichment complete — ${enrichResult.enriched} listings enriched (${enrichResult.cacheHits} cache hits)`);
      } else {
        await logSearch(search.id, "warn", `Enrichment skipped: ${enrichResult.error ?? "unknown"}`);
      }
    } catch {
      await logSearch(search.id, "warn", "Auto-enrichment failed (can retry manually)");
    }

    return;
  }

  // Start next state.
  const nextState = (pendingRuns[0] as { state_code: string }).state_code;

  const { data: configRow } = await admin
    .from("actor_configs")
    .select("*")
    .eq("id", search.actor_config_id)
    .single();
  const config = configRow as ActorConfig;

  const selection = await selectCredential(config.provider, search.credential_id);
  if ("error" in selection) return;

  const inputParams = search.input_params as {
    maxPerState?: number;
    minBeds?: number;
    maxRent?: number;
    ownerOnly?: boolean;
  };

  await startSingleStateRun({
    searchId: search.id,
    stateCode: nextState,
    config,
    token: selection.token,
    credential: selection.credential,
    maxPerState: inputParams.maxPerState ?? 200,
    minBeds: inputParams.minBeds,
    maxRent: inputParams.maxRent,
    ownerOnly: inputParams.ownerOnly,
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
