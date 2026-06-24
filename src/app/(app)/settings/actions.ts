"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { rederiveVerdicts } from "@/lib/str/enrich";

const SettingsSchema = z.object({
  global_monthly_result_budget: z.number().int().min(0).nullable(),
  hard_stop: z.boolean(),
  pipeline_enabled: z.boolean(),
  cost_haircut_pct: z.number().min(0).max(100),
  min_monthly_spread: z.number(),
  min_revenue_to_rent_ratio: z.number().min(0),
  str_provider: z.enum(["apify_airbnb", "airdna", "airroi"]),
});

export type SettingsState = { error?: string; success?: string } | undefined;

export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  await requireAdmin();

  const budgetRaw = formData.get("global_monthly_result_budget");
  const parsed = SettingsSchema.safeParse({
    global_monthly_result_budget:
      budgetRaw && String(budgetRaw).trim() !== ""
        ? Number(budgetRaw)
        : null,
    hard_stop: formData.get("hard_stop") === "on",
    pipeline_enabled: formData.get("pipeline_enabled") === "on",
    cost_haircut_pct: Number(formData.get("cost_haircut_pct")),
    min_monthly_spread: Number(formData.get("min_monthly_spread")),
    min_revenue_to_rent_ratio: Number(formData.get("min_revenue_to_rent_ratio")),
    str_provider: formData.get("str_provider"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .update(parsed.data)
    .eq("id", 1);

  if (error) return { error: "Could not save settings." };

  // Changing thresholds re-derives verdicts without re-fetching data.
  const updated = await rederiveVerdicts();

  revalidatePath("/settings");
  revalidatePath("/results");
  return { success: `Settings saved. Re-derived ${updated} verdicts.` };
}
