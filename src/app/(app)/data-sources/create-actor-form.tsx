"use client";

import { useActionState, useEffect, useRef } from "react";
import { createActorConfig, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function CreateActorForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createActorConfig,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Zillow Search" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <Input id="provider" name="provider" placeholder="apify" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="actor_id">Actor ID</Label>
          <Input
            id="actor_id"
            name="actor_id"
            placeholder="maxcopell/zillow-scraper"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source_label">Source label</Label>
          <Input id="source_label" name="source_label" placeholder="zillow" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" placeholder="US" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="input_mode">Input mode</Label>
          <Select id="input_mode" name="input_mode" defaultValue="form">
            <option value="form">form</option>
            <option value="url">url</option>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="input_template">input_template (JSON)</Label>
        <Textarea
          id="input_template"
          name="input_template"
          rows={4}
          placeholder='{ "searchUrls": [] }'
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="input_fields">input_fields (JSON array)</Label>
        <Textarea
          id="input_fields"
          name="input_fields"
          rows={4}
          placeholder='[{ "key": "location", "type": "text" }]'
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="result_mapping">result_mapping (JSON)</Label>
        <Textarea
          id="result_mapping"
          name="result_mapping"
          rows={4}
          placeholder='{ "price": "unformattedPrice", "address": "addressStreet" }'
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-green-500">{state.success}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Add data source"}
      </Button>
    </form>
  );
}
