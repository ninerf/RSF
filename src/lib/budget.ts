import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ApiCredential, AppSettings } from "@/lib/types";

export async function getSettings(): Promise<AppSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();
  // Provide defaults for Phase 3 columns that may not exist if migration 0006
  // hasn't been applied yet.
  return {
    default_search_mode: "states",
    skip_states_within_days: 7,
    str_cache_ttl_days: 30,
    management_keywords: ["LLC", "Inc", "Corp", "Realty", "Properties", "Management", "Group"],
    ...(data as object),
  } as AppSettings;
}

// Sum of results_used across all credentials this month — used for the global
// budget check.
async function globalResultsUsed(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("api_credentials")
    .select("results_used");
  const rows = (data as { results_used: number }[]) ?? [];
  return rows.reduce((sum, r) => sum + (r.results_used ?? 0), 0);
}

export interface BudgetDecision {
  ok: boolean;
  reason?: string;
}

// Run BEFORE every paid execution (Apify runs AND STR-provider calls).
// `estimatedResults` is the worst-case items the run could charge for.
export async function checkBudget(
  credential: ApiCredential,
  estimatedResults: number,
): Promise<BudgetDecision> {
  const settings = await getSettings();

  if (!settings.pipeline_enabled) {
    return { ok: false, reason: "Pipeline is disabled in Settings." };
  }

  // Credential-level limit.
  if (credential.monthly_result_limit != null) {
    const projected = credential.results_used + estimatedResults;
    if (settings.hard_stop && projected > credential.monthly_result_limit) {
      return {
        ok: false,
        reason: `Credential "${credential.label}" would exceed its monthly limit (${credential.results_used} + ${estimatedResults} > ${credential.monthly_result_limit}).`,
      };
    }
  }

  // Global budget.
  if (settings.global_monthly_result_budget != null) {
    const used = await globalResultsUsed();
    const projected = used + estimatedResults;
    if (settings.hard_stop && projected > settings.global_monthly_result_budget) {
      return {
        ok: false,
        reason: `Global monthly budget would be exceeded (${used} + ${estimatedResults} > ${settings.global_monthly_result_budget}).`,
      };
    }
  }

  return { ok: true };
}

// After completion: increment results_used and write a usage_log row.
export async function recordUsage(params: {
  credentialId: string;
  searchId: string | null;
  resultsCharged: number;
}): Promise<void> {
  const admin = createAdminClient();
  const { credentialId, searchId, resultsCharged } = params;

  const { data: cred } = await admin
    .from("api_credentials")
    .select("results_used, calls_used")
    .eq("id", credentialId)
    .single();

  const current = cred as { results_used: number; calls_used: number } | null;

  await admin
    .from("api_credentials")
    .update({
      results_used: (current?.results_used ?? 0) + resultsCharged,
      calls_used: (current?.calls_used ?? 0) + 1,
    })
    .eq("id", credentialId);

  await admin.from("usage_log").insert({
    search_id: searchId,
    credential_id: credentialId,
    results_charged: resultsCharged,
  });
}
