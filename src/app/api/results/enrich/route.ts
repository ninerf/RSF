import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectCredential } from "@/lib/credentials";
import { evaluateDeal } from "@/lib/deal";
import { getSettings } from "@/lib/budget";
import type { ResultRow } from "@/lib/types";

// Step 1: POST — start an Apify run (or return cached result instantly)
// Step 2: GET ?resultId=X&runId=Y — poll run status, finalize when done
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

  const beds = Math.floor(result.beds ?? 0);

  // Check cache first — instant return
  const { data: cached } = await admin
    .from("str_market_cache")
    .select("*")
    .eq("provider", "apify_airbnb")
    .eq("city", result.city)
    .eq("state", result.state)
    .eq("beds", beds)
    .maybeSingle();

  if (cached) {
    const settings = await getSettings();
    const deal = evaluateDeal({ monthlyRent: result.price, strMonthlyRevenue: cached.monthly_revenue }, settings);
    await admin.from("result_enrichment").upsert({
      result_id: resultId,
      str_adr: cached.adr, str_occupancy: cached.occupancy,
      str_monthly_revenue: cached.monthly_revenue, str_annual_revenue: cached.annual_revenue,
      arbitrage_spread: deal.spread, deal_verdict: deal.verdict,
      source: "apify_airbnb", computed_at: new Date().toISOString(),
    }, { onConflict: "result_id" });

    return NextResponse.json({ status: "done", data: { ...cached, arbitrage_spread: deal.spread, deal_verdict: deal.verdict } });
  }

  // Start Apify run (fast, <2s)
  const selection = await selectCredential("apify");
  if ("error" in selection) return NextResponse.json({ error: selection.error }, { status: 400 });

  const location = result.state ? `${result.city}, ${result.state}` : result.city;
  const actorInput = { location, maxResults: 10, currency: "USD", ...(beds > 0 ? { minBedrooms: beds } : {}) };

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/malikgen~airbnb-revenue-calculator/runs?token=${selection.token}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(actorInput) },
  );

  if (!startRes.ok) {
    const errData = await startRes.json().catch(() => ({})) as { error?: { message?: string } };
    const msg = errData.error?.message ?? "Failed to start Apify run";
    return NextResponse.json({ error: msg }, { status: startRes.status });
  }
  const run = (await startRes.json()) as { data: { id: string } };

  return NextResponse.json({ status: "running", runId: run.data.id, resultId });
}

export async function GET(req: NextRequest) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resultId = req.nextUrl.searchParams.get("resultId");
  const runId = req.nextUrl.searchParams.get("runId");
  if (!resultId || !runId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const admin = createAdminClient();
  const selection = await selectCredential("apify");
  if ("error" in selection) return NextResponse.json({ error: selection.error }, { status: 400 });

  // Check run status
  const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${selection.token}`);
  if (!statusRes.ok) return NextResponse.json({ error: "Failed to check run" }, { status: 500 });
  const runData = (await statusRes.json()) as { data: { status: string; defaultDatasetId: string } };

  if (runData.data.status === "RUNNING" || runData.data.status === "READY") {
    return NextResponse.json({ status: "running" });
  }

  if (runData.data.status !== "SUCCEEDED") {
    return NextResponse.json({ status: "failed", error: "Apify run failed" });
  }

  // Fetch dataset items
  const dsRes = await fetch(`https://api.apify.com/v2/datasets/${runData.data.defaultDatasetId}/items?token=${selection.token}&limit=20`);
  const items = (await dsRes.json()) as Record<string, unknown>[];

  if (!items || items.length === 0) {
    return NextResponse.json({ status: "done", error: "No revenue data found" });
  }

  // Aggregate
  type Item = { adr?: number; occupancyUsedPct?: number; occupancyPct?: { d90?: number }; estimatedRevenueMonthly?: number; estimatedRevenueAnnual?: number };
  const comps = items as unknown as Item[];
  const adrs: number[] = [], occs: number[] = [], monthlyRevs: number[] = [], annualRevs: number[] = [];

  for (const c of comps) {
    if (c.adr != null) adrs.push(c.adr);
    const occ = c.occupancyUsedPct ?? c.occupancyPct?.d90;
    if (occ != null) occs.push(occ / 100);
    if (c.estimatedRevenueMonthly != null) monthlyRevs.push(c.estimatedRevenueMonthly);
    if (c.estimatedRevenueAnnual != null) annualRevs.push(c.estimatedRevenueAnnual);
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const adr = avg(adrs), occupancy = avg(occs), monthly_revenue = avg(monthlyRevs), annual_revenue = avg(annualRevs);

  if (monthly_revenue == null) return NextResponse.json({ status: "done", error: "No revenue data" });

  // Save to cache
  const { data: result } = await admin.from("results").select("city, state, beds, price").eq("id", resultId).single();
  const beds = Math.floor((result as any)?.beds ?? 0);

  await admin.from("str_market_cache").upsert({
    provider: "apify_airbnb", city: (result as any).city, state: (result as any).state, beds,
    adr, occupancy, monthly_revenue, annual_revenue, computed_at: new Date().toISOString(),
  }, { onConflict: "provider,city,state,beds" });

  // Save enrichment
  const settings = await getSettings();
  const deal = evaluateDeal({ monthlyRent: (result as any)?.price, strMonthlyRevenue: monthly_revenue }, settings);

  await admin.from("result_enrichment").upsert({
    result_id: resultId,
    str_adr: adr, str_occupancy: occupancy,
    str_monthly_revenue: monthly_revenue, str_annual_revenue: annual_revenue,
    arbitrage_spread: deal.spread, deal_verdict: deal.verdict,
    source: "apify_airbnb", computed_at: new Date().toISOString(),
  }, { onConflict: "result_id" });

  return NextResponse.json({ status: "done", data: { adr, occupancy, monthly_revenue, annual_revenue, spread: deal.spread, verdict: deal.verdict } });
}
