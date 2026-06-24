import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateDeal } from "./deal.ts";

const settings = {
  cost_haircut_pct: 25,
  min_monthly_spread: 0,
  min_revenue_to_rent_ratio: 1.0,
};

test("Good: clears both spread and ratio", () => {
  // rent 2000, str 4000 -> net = 3000, spread = 1000, ratio = 2.0
  const d = evaluateDeal(
    { monthlyRent: 2000, strMonthlyRevenue: 4000 },
    settings,
  );
  assert.equal(d.verdict, "Good");
  assert.equal(d.net, 3000);
  assert.equal(d.spread, 1000);
  assert.equal(d.ratio, 2);
});

test("Marginal: clears ratio but not spread", () => {
  // rent 3000, str 3600 -> net = 2700, spread = -300 (fails >=0),
  // ratio = 1.2 (passes >= 1.0) => Marginal
  const d = evaluateDeal(
    { monthlyRent: 3000, strMonthlyRevenue: 3600 },
    settings,
  );
  assert.equal(d.verdict, "Marginal");
});

test("Poor: fails both", () => {
  // rent 3000, str 2000 -> net = 1500, spread = -1500, ratio = 0.67
  const d = evaluateDeal(
    { monthlyRent: 3000, strMonthlyRevenue: 2000 },
    settings,
  );
  assert.equal(d.verdict, "Poor");
});

test("null when rent or revenue missing", () => {
  assert.equal(
    evaluateDeal({ monthlyRent: null, strMonthlyRevenue: 4000 }, settings)
      .verdict,
    null,
  );
  assert.equal(
    evaluateDeal({ monthlyRent: 2000, strMonthlyRevenue: null }, settings)
      .verdict,
    null,
  );
});

test("threshold change re-derives verdict without new data", () => {
  const inputs = { monthlyRent: 2000, strMonthlyRevenue: 4000 };
  // Raise the ratio bar above 2.0 -> same data now only clears spread => Marginal
  const strict = {
    cost_haircut_pct: 25,
    min_monthly_spread: 0,
    min_revenue_to_rent_ratio: 2.5,
  };
  assert.equal(evaluateDeal(inputs, strict).verdict, "Marginal");
});
