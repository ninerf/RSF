import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectCredential } from "@/lib/credentials";
import { getRevenueAirbnbApify } from "@/lib/str/airbnb-apify";
import { evaluateDeal } from "@/lib/deal";
import { getSettings } from "@/lib/budget";
import type { ResultRow } from "@/lib/types";

// Allow up to 60s for this route (Apify sync calls take time)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { resultId } = (await req.json()) as { resultId: string };
  if (!resultId) return NextResponse.json({ error: "Missing resultId" }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin.from("results").select("*").eq("id", resultId).single();
  const result = row as ResultRow | null;
  if (!result || !result.city || !result.state) {
    return NextResponse.json({ error: "Result not found." }, { status: 404 });
  }

  const selection = await selectCredential("apify");
  if ("error" in selection) return NextResponse.json({ error: selection.error }, { status: 400 });

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

  if (revenue.monthly_revenue == null) {
    return NextResponse.json({ error: "No revenue data found for this area." }, { status: 404 });
  }

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

  return NextResponse.json({
    str_monthly_revenue: revenue.monthly_revenue,
    str_annual_revenue: revenue.annual_revenue,
    str_adr: revenue.adr,
    str_occupancy: revenue.occupancy,
    arbitrage_spread: deal.spread,
    deal_verdict: deal.verdict,
  });
}
