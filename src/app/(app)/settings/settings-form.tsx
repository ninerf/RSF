"use client";

import { useActionState } from "react";
import { updateSettings, type SettingsState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { AppSettings } from "@/lib/types";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    updateSettings,
    undefined,
  );

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="global_monthly_result_budget">
            Global monthly result budget
          </Label>
          <Input
            id="global_monthly_result_budget"
            name="global_monthly_result_budget"
            type="number"
            min={0}
            defaultValue={settings.global_monthly_result_budget ?? ""}
            placeholder="Unlimited"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="str_provider">Default STR provider</Label>
          <Select
            id="str_provider"
            name="str_provider"
            defaultValue={settings.str_provider}
          >
            <option value="apify_airbnb">Apify Airbnb (default)</option>
            <option value="airdna">AirDNA</option>
            <option value="airroi">AirROI</option>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="hard_stop"
            name="hard_stop"
            defaultChecked={settings.hard_stop}
          />
          <Label htmlFor="hard_stop">Hard stop on budget</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="pipeline_enabled"
            name="pipeline_enabled"
            defaultChecked={settings.pipeline_enabled}
          />
          <Label htmlFor="pipeline_enabled">Pipeline enabled</Label>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-medium">Deal evaluation</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cost_haircut_pct">Cost haircut %</Label>
            <Input
              id="cost_haircut_pct"
              name="cost_haircut_pct"
              type="number"
              min={0}
              max={100}
              step="1"
              defaultValue={settings.cost_haircut_pct}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_monthly_spread">Min monthly spread ($)</Label>
            <Input
              id="min_monthly_spread"
              name="min_monthly_spread"
              type="number"
              step="1"
              defaultValue={settings.min_monthly_spread}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min_revenue_to_rent_ratio">
              Min revenue/rent ratio
            </Label>
            <Input
              id="min_revenue_to_rent_ratio"
              name="min_revenue_to_rent_ratio"
              type="number"
              step="0.1"
              defaultValue={settings.min_revenue_to_rent_ratio}
            />
          </div>
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-green-500">{state.success}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save settings"}
      </Button>
    </form>
  );
}
