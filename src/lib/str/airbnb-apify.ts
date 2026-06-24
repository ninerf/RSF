import "server-only";

import { ApifyClient } from "apify-client";
import type { RevenueInput, RevenueResult } from "@/lib/types";

const AIRBNB_ACTOR_ID = "tri_angle/airbnb-scraper";

// Parse "$107" / "$1,234" -> 107 / 1234.
function parseMoney(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface AirbnbItem {
  price?: { amount?: string; qualifier?: string };
  rating?: { reviewsCount?: number };
}

// Occupancy proxy from review volume. Reviews are a weak signal of bookings;
// we map review count to an occupancy band, capped at 0.70. Listings with no
// reviews fall back to a conservative 0.45 baseline.
function occupancyFromReviews(reviewCounts: number[]): number {
  if (reviewCounts.length === 0) return 0.45;
  const avg =
    reviewCounts.reduce((a, b) => a + b, 0) / reviewCounts.length;
  // ~ every 12 reviews ≈ +5% occupancy over a 0.45 base, capped at 0.70.
  const est = 0.45 + Math.min(avg / 12, 5) * 0.05;
  return Math.min(est, 0.7);
}

// Apify Airbnb market-data adapter (DEFAULT). Area-based: queries the city
// with a bedroom filter, computes ADR as the mean nightly rate of comps and an
// occupancy proxy from review counts. Runs async (start → poll) so it never
// blocks past Vercel's function timeout.
export async function getRevenueAirbnbApify(
  input: RevenueInput,
  token: string,
  options: { maxItems?: number; pollMs?: number; timeoutMs?: number } = {},
): Promise<RevenueResult> {
  const { city, state, beds } = input;
  if (!city) {
    return {
      adr: null,
      occupancy: null,
      monthly_revenue: null,
      annual_revenue: null,
      provider: "apify_airbnb",
    };
  }

  const maxItems = options.maxItems ?? 50;
  const pollMs = options.pollMs ?? 3000;
  const timeoutMs = options.timeoutMs ?? 55000;

  const client = new ApifyClient({ token });
  const locationQuery = state ? `${city}, ${state}` : city;

  const actorInput: Record<string, unknown> = {
    locationQueries: [locationQuery],
    currency: "USD",
    maxResults: maxItems,
  };
  if (beds && beds > 0) actorInput.minBedrooms = Math.floor(beds);

  const run = await client
    .actor(AIRBNB_ACTOR_ID)
    .start(actorInput, { maxItems });

  // Poll until terminal or timeout.
  const deadline = Date.now() + timeoutMs;
  let datasetId: string | undefined;
  while (Date.now() <= deadline) {
    const r = await client.run(run.id).get();
    if (!r) break;
    if (r.status === "SUCCEEDED") {
      datasetId = r.defaultDatasetId;
      break;
    }
    if (["FAILED", "TIMED-OUT", "ABORTED"].includes(r.status)) break;
    await new Promise((res) => setTimeout(res, pollMs));
  }

  if (!datasetId) {
    return {
      adr: null,
      occupancy: null,
      monthly_revenue: null,
      annual_revenue: null,
      provider: "apify_airbnb",
    };
  }

  const { items } = await client.dataset(datasetId).listItems();
  const comps = items as unknown as AirbnbItem[];

  const nightly = comps
    .map((c) => parseMoney(c.price?.amount))
    .filter((n): n is number => n !== null);

  if (nightly.length === 0) {
    return {
      adr: null,
      occupancy: null,
      monthly_revenue: null,
      annual_revenue: null,
      comps: items as unknown[],
      provider: "apify_airbnb",
    };
  }

  const adr = nightly.reduce((a, b) => a + b, 0) / nightly.length;
  const reviewCounts = comps
    .map((c) => c.rating?.reviewsCount)
    .filter((n): n is number => typeof n === "number");
  const occupancy = occupancyFromReviews(reviewCounts);
  const monthly_revenue = adr * 30 * occupancy;
  const annual_revenue = monthly_revenue * 12;

  return {
    adr: Math.round(adr * 100) / 100,
    occupancy: Math.round(occupancy * 1000) / 1000,
    monthly_revenue: Math.round(monthly_revenue),
    annual_revenue: Math.round(annual_revenue),
    comps: items.slice(0, 10) as unknown[],
    provider: "apify_airbnb",
  };
}
