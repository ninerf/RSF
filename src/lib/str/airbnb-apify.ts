import "server-only";

import type { RevenueInput, RevenueResult } from "@/lib/types";

// Uses malikgen/airbnb-revenue-calculator via Apify REST API with sync call.
// Returns real occupancy, ADR, and revenue from Airbnb's forward calendar.
const REVENUE_ACTOR_ID = "malikgen~airbnb-revenue-calculator";

export async function getRevenueAirbnbApify(
  input: RevenueInput,
  token: string,
  options: { maxItems?: number } = {},
): Promise<RevenueResult> {
  const { city, state, beds } = input;
  if (!city) {
    return { adr: null, occupancy: null, monthly_revenue: null, annual_revenue: null, provider: "apify_airbnb" };
  }

  const maxItems = options.maxItems ?? 10;
  const location = state ? `${city}, ${state}` : city;

  const actorInput: Record<string, unknown> = {
    location,
    maxResults: maxItems,
    currency: "USD",
  };
  if (beds && beds > 0) actorInput.minBedrooms = Math.floor(beds);

  // Use Apify's run-sync-get-dataset-items endpoint — waits for completion and returns items directly.
  // Timeout set to 120s on Apify's side (their server holds the connection).
  const res = await fetch(
    `https://api.apify.com/v2/acts/${REVENUE_ACTOR_ID}/run-sync-get-dataset-items?token=${token}&timeout=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(actorInput),
    },
  );

  if (!res.ok) {
    return { adr: null, occupancy: null, monthly_revenue: null, annual_revenue: null, provider: "apify_airbnb" };
  }

  const items = (await res.json()) as Record<string, unknown>[];

  if (!items || items.length === 0) {
    return { adr: null, occupancy: null, monthly_revenue: null, annual_revenue: null, provider: "apify_airbnb" };
  }

  type Item = {
    adr?: number;
    occupancyPct?: { d90?: number };
    occupancyUsedPct?: number;
    estimatedRevenueMonthly?: number;
    estimatedRevenueAnnual?: number;
  };

  const comps = items as unknown as Item[];
  const adrs: number[] = [];
  const occs: number[] = [];
  const monthlyRevs: number[] = [];
  const annualRevs: number[] = [];

  for (const c of comps) {
    if (c.adr != null) adrs.push(c.adr);
    const occ = c.occupancyUsedPct ?? c.occupancyPct?.d90;
    if (occ != null) occs.push(occ / 100);
    if (c.estimatedRevenueMonthly != null) monthlyRevs.push(c.estimatedRevenueMonthly);
    if (c.estimatedRevenueAnnual != null) annualRevs.push(c.estimatedRevenueAnnual);
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  const adr = avg(adrs);
  const occupancy = avg(occs);
  const monthly_revenue = avg(monthlyRevs);
  const annual_revenue = avg(annualRevs);

  return {
    adr: adr != null ? Math.round(adr * 100) / 100 : null,
    occupancy: occupancy != null ? Math.round(occupancy * 1000) / 1000 : null,
    monthly_revenue: monthly_revenue != null ? Math.round(monthly_revenue) : null,
    annual_revenue: annual_revenue != null ? Math.round(annual_revenue) : null,
    comps: items.slice(0, 5) as unknown[],
    provider: "apify_airbnb",
  };
}
