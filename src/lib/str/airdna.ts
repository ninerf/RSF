import "server-only";

import type { RevenueInput, RevenueResult } from "@/lib/types";

export class CredentialRequiredError extends Error {
  constructor(provider: string) {
    super(`${provider} credential required`);
    this.name = "CredentialRequiredError";
  }
}

// AirDNA Rentalizer adapter (address-based). Token obtained by contacting
// AirDNA + payment (no self-serve), so this stays INACTIVE until a token
// exists. Without a token the caller surfaces a clear "needs credential" state.
export async function getRevenueAirdna(
  input: RevenueInput,
  token: string | null,
): Promise<RevenueResult> {
  if (!token) throw new CredentialRequiredError("AirDNA");

  const params = new URLSearchParams();
  if (input.address) params.set("address", input.address);
  if (input.city) params.set("city", input.city);
  if (input.state) params.set("state", input.state);
  if (input.beds != null) params.set("bedrooms", String(Math.floor(input.beds)));
  if (input.lat != null) params.set("lat", String(input.lat));
  if (input.lng != null) params.set("lng", String(input.lng));

  const res = await fetch(
    `https://api.airdna.co/v1/rentalizer/estimate?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    throw new Error(`AirDNA returned HTTP ${res.status}.`);
  }

  const json = (await res.json()) as {
    data?: {
      property_stats?: {
        adr?: number;
        occupancy?: number;
        revenue?: number;
      };
      comps?: unknown[];
    };
  };

  const stats = json.data?.property_stats ?? {};
  const adr = stats.adr ?? null;
  const occupancy = stats.occupancy ?? null;
  const monthly_revenue = stats.revenue ?? null;

  return {
    adr,
    occupancy,
    monthly_revenue,
    annual_revenue: monthly_revenue != null ? monthly_revenue * 12 : null,
    comps: (json.data?.comps ?? []).slice(0, 10),
    provider: "airdna",
  };
}
