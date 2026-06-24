import "server-only";

import { ApifyClient } from "apify-client";
import type { RevenueInput, RevenueResult } from "@/lib/types";

// Uses malikgen/airbnb-revenue-calculator — a proper AirDNA alternative on Apify.
// $5/1000 results, uses your existing Apify token. Gives real occupancy, ADR,
// and revenue estimates from Airbnb's forward calendar data.
const REVENUE_ACTOR_ID = "malikgen/airbnb-revenue-calculator";

export async function getRevenueAirbnbApify(
  input: RevenueInput,
  token: string,
  options: { maxItems?: number; pollMs?: number; timeoutMs?: number } = {},
): Promise<RevenueResult> {
  const { city, state, beds } = input;
  if (!city) {
    return { adr: null, occupancy: null, monthly_revenue: null, annual_revenue: null, provider: "apify_airbnb" };
  }

  const maxItems = options.maxItems ?? 20;
  const pollMs = options.pollMs ?? 5000;
  const timeoutMs = options.timeoutMs ?? 120000; // revenue calc takes longer

  const client = new ApifyClient({ token });
  const location = state ? `${city}, ${state}` : city;

  const actorInput: Record<string, unknown> = {
    location,
    maxResults: maxItems,
    currency: "USD",
  };
  if (beds && beds > 0) actorInput.minBedrooms = Math.floor(beds);

  const run = await client.actor(REVENUE_ACTOR_ID).start(actorInput);

  // Poll until terminal or timeout.
  const deadline = Date.now() + timeoutMs;
  let datasetId: string | undefined;
  while (Date.now() <= deadline) {
    const r = await client.run(run.id).get();
    if (!r) break;
    if (r.status === "SUCCEEDED") { datasetId = r.defaultDatasetId; break; }
    if (["FAILED", "TIMED-OUT", "ABORTED"].includes(r.status)) break;
    await new Promise((res) => setTimeout(res, pollMs));
  }

  if (!datasetId) {
    return { adr: null, occupancy: null, monthly_revenue: null, annual_revenue: null, provider: "apify_airbnb" };
  }

  const { items } = await client.dataset(datasetId).listItems();

  if (!items || items.length === 0) {
    return { adr: null, occupancy: null, monthly_revenue: null, annual_revenue: null, provider: "apify_airbnb" };
  }

  // Aggregate across comps: average the ADR, occupancy (90-day), and revenue.
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
    if (occ != null) occs.push(occ / 100); // convert from % to decimal
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
