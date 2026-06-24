import type { AppSettings, DealVerdict } from "@/lib/types";

export interface DealInputs {
  monthlyRent: number | null;
  strMonthlyRevenue: number | null;
}

export interface DealComputation {
  net: number | null;
  spread: number | null;
  ratio: number | null;
  verdict: DealVerdict | null;
}

// Compute net STR revenue (after a cost haircut), the monthly spread vs rent,
// the revenue-to-rent ratio, and the deal verdict. Pure: changing thresholds
// re-derives verdicts without any API calls.
export function evaluateDeal(
  inputs: DealInputs,
  settings: Pick<
    AppSettings,
    "cost_haircut_pct" | "min_monthly_spread" | "min_revenue_to_rent_ratio"
  >,
): DealComputation {
  const { monthlyRent, strMonthlyRevenue } = inputs;

  if (
    strMonthlyRevenue == null ||
    monthlyRent == null ||
    monthlyRent <= 0
  ) {
    return { net: null, spread: null, ratio: null, verdict: null };
  }

  const net = strMonthlyRevenue * (1 - settings.cost_haircut_pct / 100);
  const spread = net - monthlyRent;
  const ratio = strMonthlyRevenue / monthlyRent;

  const meetsSpread = spread >= settings.min_monthly_spread;
  const meetsRatio = ratio >= settings.min_revenue_to_rent_ratio;

  let verdict: DealVerdict;
  if (meetsSpread && meetsRatio) {
    verdict = "Good";
  } else if (meetsSpread || meetsRatio) {
    verdict = "Marginal";
  } else {
    verdict = "Poor";
  }

  return { net, spread, ratio, verdict };
}
