"use client";

import { useActionState } from "react";
import { enrichSearchAction, type RunState } from "./actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function EnrichForm({
  searchId,
  defaultProvider,
}: {
  searchId: string;
  defaultProvider: string;
}) {
  const [state, action, pending] = useActionState<RunState, FormData>(
    enrichSearchAction,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="search_id" value={searchId} />
      <div className="flex items-center gap-2">
        <Select
          name="provider"
          defaultValue={defaultProvider}
          className="h-8 w-40 text-xs"
        >
          <option value="apify_airbnb">Apify Airbnb</option>
          <option value="airdna">AirDNA</option>
          <option value="airroi">AirROI</option>
        </Select>
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Enriching..." : "Enrich STR"}
        </Button>
      </div>
      {state?.error && (
        <p className="text-xs text-destructive">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-xs text-green-500">{state.success}</p>
      )}
    </form>
  );
}
