"use server";

import { revalidatePath } from "next/cache";
import { requireRunner } from "@/lib/auth-run";
import { requireStaff } from "@/lib/auth";
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
  await requireStaff();
  const admin = createAdminClient();
  await admin.from("results").update({ archived }).eq("id", resultId);
}

// --- Worker / admin review workflow --------------------------------------

// Approve a property: eligible for the client deals view (if it also has a
// name, number, and a Good verdict). Clears any prior disapproval/flag.
export async function approveResult(resultId: string): Promise<void> {
  const me = await requireStaff();
  const admin = createAdminClient();
  await admin
    .from("results")
    .update({
      review_status: "approved",
      reviewed_by: me.id,
      reviewed_at: new Date().toISOString(),
      archived: false,
      flagged_by: null,
      flag_note: null,
    })
    .eq("id", resultId);
  revalidatePath("/results");
  revalidatePath("/deals");
}

// Disapprove a property: archive it and mark disapproved.
export async function disapproveResult(resultId: string): Promise<void> {
  const me = await requireStaff();
  const admin = createAdminClient();
  await admin
    .from("results")
    .update({
      review_status: "disapproved",
      reviewed_by: me.id,
      reviewed_at: new Date().toISOString(),
      archived: true,
    })
    .eq("id", resultId);
  revalidatePath("/results");
  revalidatePath("/deals");
}

// Worker/admin edits the owner contact details + availability "on talk".
export async function updateOwnerInfo(
  resultId: string,
  fields: { owner_name: string; contact_phone: string; availability_status: string },
): Promise<{ error?: string }> {
  await requireStaff();
  const admin = createAdminClient();
  await admin
    .from("results")
    .update({
      owner_name: fields.owner_name.trim() || null,
      contact_phone: fields.contact_phone.trim() || null,
      availability_status: fields.availability_status.trim() || null,
    })
    .eq("id", resultId);
  revalidatePath("/results");
  revalidatePath("/deals");
  return {};
}

// Manually enter the STR ("APR") numbers when the scraper has none. Recomputes
// the deal verdict from the monthly STR revenue vs the listing rent.
export async function addManualApr(
  resultId: string,
  strMonthlyRevenue: number,
): Promise<{ error?: string }> {
  await requireStaff();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("results")
    .select("price")
    .eq("id", resultId)
    .single();
  const result = row as { price: number | null } | null;
  if (!result) return { error: "Result not found." };
  if (!Number.isFinite(strMonthlyRevenue) || strMonthlyRevenue <= 0) {
    return { error: "Enter a positive monthly STR revenue." };
  }

  const settings = await getSettings();
  const deal = evaluateDeal(
    { monthlyRent: result.price, strMonthlyRevenue },
    settings,
  );

  await admin.from("result_enrichment").upsert(
    {
      result_id: resultId,
      str_monthly_revenue: strMonthlyRevenue,
      str_annual_revenue: strMonthlyRevenue * 12,
      arbitrage_spread: deal.spread,
      deal_verdict: deal.verdict,
      source: "manual",
      computed_at: new Date().toISOString(),
    },
    { onConflict: "result_id" },
  );

  revalidatePath("/results");
  revalidatePath("/deals");
  return {};
}
