"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCredential, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export function CreateCredentialForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createCredential,
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
          <Label htmlFor="provider">Provider</Label>
          <Input
            id="provider"
            name="provider"
            placeholder="apify"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            name="label"
            placeholder="Primary Apify token"
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="token">API token</Label>
          <Input
            id="token"
            name="token"
            type="password"
            autoComplete="off"
            placeholder="Entered once, stored encrypted, never shown again"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthly_result_limit">
            Monthly result limit (optional)
          </Label>
          <Input
            id="monthly_result_limit"
            name="monthly_result_limit"
            type="number"
            min={1}
          />
        </div>
        <div className="flex items-center gap-2 pt-7">
          <Checkbox id="is_paid" name="is_paid" />
          <Label htmlFor="is_paid">Paid plan</Label>
        </div>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-green-500">{state.success}</p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Storing..." : "Add credential"}
      </Button>
    </form>
  );
}
