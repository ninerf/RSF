"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runSearch, type RunState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatUSD } from "@/lib/format";

interface InputField {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
}

export interface ActorConfigOption {
  id: string;
  name: string;
  provider: string;
  input_mode: "url" | "form";
  input_fields: InputField[];
}

export interface CredentialOption {
  id: string;
  label: string;
  provider: string;
  remaining: number | null;
}

// Approx Apify cost per result for the Zillow scraper (USD). Display-only.
const APPROX_COST_PER_RESULT = 0.002;

export function NewSearchForm({
  configs,
  credentials,
}: {
  configs: ActorConfigOption[];
  credentials: CredentialOption[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<RunState, FormData>(
    runSearch,
    undefined,
  );

  const [configId, setConfigId] = useState(configs[0]?.id ?? "");
  const [maxItems, setMaxItems] = useState(100);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const selectedConfig = useMemo(
    () => configs.find((c) => c.id === configId),
    [configId, configs],
  );

  const relevantCreds = useMemo(
    () =>
      credentials.filter(
        (c) => c.provider === (selectedConfig?.provider ?? ""),
      ),
    [credentials, selectedConfig],
  );

  // Live status polling after a successful start.
  const [status, setStatus] = useState<string | null>(null);
  const startedId = state?.searchId;

  useEffect(() => {
    if (!startedId) return;
    setStatus("running");
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/searches/${startedId}/status`);
        const data = await res.json();
        if (!active) return;
        setStatus(data.status);
        if (["succeeded", "failed", "aborted"].includes(data.status)) {
          router.refresh();
          return;
        }
      } catch {
        // keep polling
      }
      if (active) setTimeout(tick, 3000);
    };
    const t = setTimeout(tick, 2000);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [startedId, router]);

  const estCost = maxItems * APPROX_COST_PER_RESULT;

  return (
    <>
      <form ref={formRef} action={action} className="space-y-4">
        <input type="hidden" name="actorConfigId" value={configId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="config">Data source</Label>
            <Select
              id="config"
              value={configId}
              onChange={(e) => setConfigId(e.target.value)}
            >
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input id="name" name="name" placeholder="Miami 2BR rentals" />
          </div>
        </div>

        {/* Dynamic inputs from the config */}
        {selectedConfig?.input_mode === "url" ? (
          <div className="space-y-2">
            <Label htmlFor="field_url">
              Zillow for_rent URL (must contain ?searchQueryState=)
            </Label>
            <Input
              id="field_url"
              name="field_url"
              placeholder="https://www.zillow.com/homes/for_rent/?searchQueryState=..."
              required
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {selectedConfig?.input_fields?.map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={`field_${f.key}`}>{f.label}</Label>
                <Input
                  id={`field_${f.key}`}
                  name={`field_${f.key}`}
                  type={f.type === "number" ? "number" : "text"}
                  required={f.required}
                />
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maxItems">Max results</Label>
            <Input
              id="maxItems"
              name="maxItems"
              type="number"
              min={1}
              max={2000}
              value={maxItems}
              onChange={(e) => setMaxItems(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="credentialId">Credential</Label>
            <Select id="credentialId" name="credentialId" defaultValue="auto">
              <option value="auto">Auto (most headroom)</option>
              {relevantCreds.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.remaining != null ? ` (${c.remaining} left)` : ""}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* params JSON is assembled at confirm time */}
        <input type="hidden" name="params" id="params-json" value="{}" />

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        {state?.success && (
          <p className="text-sm text-green-500">
            {state.success}
            {state.credentialLabel
              ? ` Using credential: ${state.credentialLabel}.`
              : ""}
            {status ? ` Status: ${status}.` : ""}
          </p>
        )}

        <Button
          type="button"
          disabled={pending}
          onClick={() => {
            // Assemble params from field_* inputs into the hidden JSON field.
            const fd = new FormData(formRef.current!);
            const params: Record<string, string> = {};
            for (const [k, v] of fd.entries()) {
              if (k.startsWith("field_")) params[k.slice(6)] = String(v);
            }
            (
              document.getElementById("params-json") as HTMLInputElement
            ).value = JSON.stringify(params);
            setConfirmOpen(true);
          }}
        >
          {pending ? "Starting..." : "Run"}
        </Button>
      </form>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm run</DialogTitle>
            <DialogDescription>
              This run can return up to {maxItems} results. Estimated maximum
              cost: {formatUSD(estCost)} (~{APPROX_COST_PER_RESULT}/result).
              You only pay for results actually returned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() => {
                setConfirmOpen(false);
                formRef.current?.requestSubmit();
              }}
            >
              Confirm &amp; run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
