import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { selectCredential } from "@/lib/credentials";
import { checkBudget, recordUsage, getSettings } from "@/lib/budget";
import { evaluateDeal } from "@/lib/deal";
import { getRevenueAirbnbApify } from "./airbnb-apify";
import { getRevenueAirdna, CredentialRequiredError } from "./airdna";
import { getRevenueAirroi } from "./airroi";
import type { ResultRow, RevenueResult } from "@/lib/types";

// Which provider names use which underlying credential provider.
const CREDENTIAL_PROVIDER: Record<string, string> = {
  apify_airbnb: "apify",
  airdna: "airdna",
  airroi: "airroi",
};

export interface EnrichResult {
  ok: boolean;
  error?: string;
  enriched: number;
  cacheHits: number;
  needsCredential?: string;
}

function cacheKey(city: string, state: string, beds: number) {
  return `${city.toLowerCase()}|${state.toLowerCase()}|${beds}`;
}

// Enrich a search's results with STR revenue. Re-runnable without re-scraping
// Zillow (operates on stored results). Caches per (provider, city, state, beds)
// so the same area isn't paid for once per property.
export async function enrichSearch(params: {
  searchId: string;
  provider: string;
}): Promise<EnrichResult> {
  const { searchId, provider } = params;
  const admin = createAdminClient();
  const settings = await getSettings();

  const { data: resultRows } = await admin
    .from("results")
    .select("*")
    .eq("search_id", searchId);

  const results = (resultRows as ResultRow[]) ?? [];
  if (results.length === 0) {
    return { ok: false, error: "No results to enrich.", enriched: 0, cacheHits: 0 };
  }

  // Resolve a credential/token if the provider needs one.
  const credProvider = CREDENTIAL_PROVIDER[provider] ?? provider;
  const selection = await selectCredential(credProvider);
  if ("error" in selection) {
    if (provider === "airdna" || provider === "airroi") {
      return {
        ok: false,
        error: `${provider} credential required`,
        enriched: 0,
        cacheHits: 0,
        needsCredential: provider,
      };
    }
    return { ok: false, error: selection.error, enriched: 0, cacheHits: 0 };
  }
  const { credential, token } = selection;

  // Distinct (city, state, beds) groups drive paid lookups.
  const groups = new Map<string, { city: string; state: string; beds: number }>();
  for (const r of results) {
    if (!r.city || !r.state) continue;
    const beds = Math.floor(r.beds ?? 0);
    groups.set(cacheKey(r.city, r.state, beds), {
      city: r.city,
      state: r.state,
      beds,
    });
  }

  // Resolve revenue per group, using cache + budget guard for paid calls.
  const revenueByKey = new Map<string, RevenueResult>();
  let cacheHits = 0;
  let paidCalls = 0;

  for (const [key, g] of groups) {
    // Cache check.
    const { data: cached } = await admin
      .from("str_market_cache")
      .select("*")
      .eq("provider", provider)
      .eq("city", g.city)
      .eq("state", g.state)
      .eq("beds", g.beds)
      .maybeSingle();

    if (cached) {
      cacheHits++;
      revenueByKey.set(key, {
        adr: cached.adr,
        occupancy: cached.occupancy,
        monthly_revenue: cached.monthly_revenue,
        annual_revenue: cached.annual_revenue,
        provider,
      });
      continue;
    }

    // Budget guard before each paid lookup.
    const budget = await checkBudget(credential, 1);
    if (!budget.ok) {
      return { ok: false, error: budget.reason, enriched: 0, cacheHits };
    }

    let revenue: RevenueResult;
    try {
      const input = {
        address: null,
        city: g.city,
        state: g.state,
        beds: g.beds,
        lat: null,
        lng: null,
      };
      if (provider === "apify_airbnb") {
        revenue = await getRevenueAirbnbApify(input, token);
      } else if (provider === "airdna") {
        revenue = await getRevenueAirdna(input, token);
      } else if (provider === "airroi") {
        revenue = await getRevenueAirroi(input, token);
      } else {
        return { ok: false, error: `Unknown STR provider "${provider}".`, enriched: 0, cacheHits };
      }
    } catch (err) {
      if (err instanceof CredentialRequiredError) {
        return {
          ok: false,
          error: err.message,
          enriched: 0,
          cacheHits,
          needsCredential: provider,
        };
      }
      // Skip this group on transient errors but keep going.
      continue;
    }

    paidCalls++;
    revenueByKey.set(key, revenue);

    // Persist to cache.
    await admin.from("str_market_cache").upsert(
      {
        provider,
        city: g.city,
        state: g.state,
        beds: g.beds,
        adr: revenue.adr,
        occupancy: revenue.occupancy,
        monthly_revenue: revenue.monthly_revenue,
        annual_revenue: revenue.annual_revenue,
        comps: revenue.comps ?? null,
        computed_at: new Date().toISOString(),
      },
      { onConflict: "provider,city,state,beds" },
    );
  }

  // Charge usage once per paid call (each Apify run / API call = 1 call).
  if (paidCalls > 0) {
    await recordUsage({
      credentialId: credential.id,
      searchId,
      resultsCharged: paidCalls,
    });
  }

  // Write enrichment rows with deal verdicts.
  let enriched = 0;
  const enrichmentRows = [];
  for (const r of results) {
    if (!r.city || !r.state) continue;
    const beds = Math.floor(r.beds ?? 0);
    const revenue = revenueByKey.get(cacheKey(r.city, r.state, beds));
    if (!revenue || revenue.monthly_revenue == null) continue;

    const deal = evaluateDeal(
      { monthlyRent: r.price, strMonthlyRevenue: revenue.monthly_revenue },
      settings,
    );

    enrichmentRows.push({
      result_id: r.id,
      str_adr: revenue.adr,
      str_occupancy: revenue.occupancy,
      str_monthly_revenue: revenue.monthly_revenue,
      str_annual_revenue: revenue.annual_revenue,
      arbitrage_spread: deal.spread,
      deal_verdict: deal.verdict,
      source: provider,
      computed_at: new Date().toISOString(),
    });
    enriched++;
  }

  if (enrichmentRows.length > 0) {
    await admin
      .from("result_enrichment")
      .upsert(enrichmentRows, { onConflict: "result_id" });
  }

  return { ok: true, enriched, cacheHits };
}

// Re-derive deal verdicts for ALL enriched results using current settings —
// no API calls. Used when thresholds change in Settings.
export async function rederiveVerdicts(): Promise<number> {
  const admin = createAdminClient();
  const settings = await getSettings();

  const { data } = await admin
    .from("result_enrichment")
    .select("result_id, str_monthly_revenue, results(price)");

  type Row = {
    result_id: string;
    str_monthly_revenue: number | null;
    results: { price: number | null } | null;
  };
  const rows = (data as unknown as Row[]) ?? [];

  let updated = 0;
  for (const row of rows) {
    if (row.str_monthly_revenue == null) continue;
    const deal = evaluateDeal(
      {
        monthlyRent: row.results?.price ?? null,
        strMonthlyRevenue: row.str_monthly_revenue,
      },
      settings,
    );
    await admin
      .from("result_enrichment")
      .update({
        arbitrage_spread: deal.spread,
        deal_verdict: deal.verdict,
      })
      .eq("result_id", row.result_id);
    updated++;
  }

  return updated;
}
