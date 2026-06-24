import "server-only";

import type { RevenueInput, RevenueResult } from "@/lib/types";
import { CredentialRequiredError } from "./airdna";

// AirROI adapter (address/market revenue calculator). Self-serve
// pay-as-you-go: a token is added via the Credentials admin. Same interface as
// the other STR adapters.
export async function getRevenueAirroi(
  input: RevenueInput,
  token: string | null,
): Promise<RevenueResult> {
  if (!token) throw new CredentialRequiredError("AirROI");

  const body: Record<string, unknown> = {
    address: input.address,
    city: input.city,
    state: input.state,
    bedrooms: input.beds != null ? Math.floor(input.beds) : undefined,
    latitude: input.lat,
    longitude: input.lng,
  };

  const res = await fetch("https://api.airroi.com/v1/estimate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`AirROI returned HTTP ${res.status}.`);
  }

  const json = (await res.json()) as {
    adr?: number;
    occupancy?: number;
    monthly_revenue?: number;
    annual_revenue?: number;
    comps?: unknown[];
  };

  const monthly = json.monthly_revenue ?? null;
  return {
    adr: json.adr ?? null,
    occupancy: json.occupancy ?? null,
    monthly_revenue: monthly,
    annual_revenue:
      json.annual_revenue ?? (monthly != null ? monthly * 12 : null),
    comps: (json.comps ?? []).slice(0, 10),
    provider: "airroi",
  };
}
