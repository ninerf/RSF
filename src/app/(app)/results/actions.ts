"use server";

import { revalidatePath } from "next/cache";
import { requireRunner } from "@/lib/auth-run";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectCredential } from "@/lib/credentials";
import { getRevenueAirbnbApify } from "@/lib/str/airbnb-apify";
import { evaluateDeal } from "@/lib/deal";
import { getSettings } from "@/lib/budget";
import type { ResultRow } from "@/lib/types";

export async function enrichResult(resultId: string): Promise<{ error?: string }> {
  await requireRunner();
  const admin = createAdminClient();

  const { data: row } = await admin.from("results").select("*").eq("id", resultId).single();
  const result = row as ResultRow | null;
  if (!result || !result.city || !result.state) return { error: "Result not found." };

  const selection = await selectCredential("apify");
  if ("error" in selection) return { error: selection.error };

  const { token } = selection;
  const beds = Math.floor(result.beds ?? 0);

  // Check cache first
  const { data: cached } = await admin
    .from("str_market_cache")
    .select("*")
    .eq("provider", "apify_airbnb")
    .eq("city", result.city)
    .eq("state", result.state)
    .eq("beds", beds)
    .maybeSingle();

  let revenue;
  if (cached) {
    revenue = { adr: cached.adr, occupancy: cached.occupancy, monthly_revenue: cached.monthly_revenue, annual_revenue: cached.annual_revenue, provider: "apify_airbnb" };
  } else {
    revenue = await getRevenueAirbnbApify({ address: result.address, city: result.city, state: result.state, beds, lat: result.latitude, lng: result.longitude }, token);

    if (revenue.monthly_revenue != null) {
      await admin.from("str_market_cache").upsert({
        provider: "apify_airbnb", city: result.city, state: result.state, beds,
        adr: revenue.adr, occupancy: revenue.occupancy,
        monthly_revenue: revenue.monthly_revenue, annual_revenue: revenue.annual_revenue,
        computed_at: new Date().toISOString(),
      }, { onConflict: "provider,city,state,beds" });
    }
  }

  if (revenue.monthly_revenue == null) return { error: "No revenue data found for this area." };

  const settings = await getSettings();
  const deal = evaluateDeal({ monthlyRent: result.price, strMonthlyRevenue: revenue.monthly_revenue }, settings);

  await admin.from("result_enrichment").upsert({
    result_id: resultId,
    str_adr: revenue.adr,
    str_occupancy: revenue.occupancy,
    str_monthly_revenue: revenue.monthly_revenue,
    str_annual_revenue: revenue.annual_revenue,
    arbitrage_spread: deal.spread,
    deal_verdict: deal.verdict,
    source: "apify_airbnb",
    computed_at: new Date().toISOString(),
  }, { onConflict: "result_id" });

  revalidatePath("/results");
  return {};
}

export async function toggleArchive(resultId: string, archived: boolean): Promise<void> {
  await requireRunner();
  const admin = createAdminClient();
  await admin.from("results").update({ archived }).eq("id", resultId);
}
