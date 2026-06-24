"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { runSearch, runStateSearch, type RunState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StateSelector } from "@/components/state-selector";
import { US_STATES, type StateCode } from "@/lib/constants/us-states";
import { formatUSD } from "@/lib/format";

export interface ActorConfigOption {
  id: string;
  name: string;
  provider: string;
  input_mode: "url" | "form";
  input_fields: { key: string; label: string; type?: string; required?: boolean }[];
}

export interface CredentialOption {
  id: string;
  label: string;
  provider: string;
  remaining: number | null;
}

const APPROX_COST_PER_RESULT = 0.002;

export function NewSearchForm({
  configs,
  credentials,
  recentlySearched,
}: {
  configs: ActorConfigOption[];
  credentials: CredentialOption[];
  recentlySearched?: Record<string, string>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"states" | "url">("states");

  // --- States mode state ---
  const [selectedStates, setSelectedStates] = useState<StateCode[]>(
    US_STATES.map((s) => s.code),
  );
  const [maxPerState, setMaxPerState] = useState(200);
  const [minBeds, setMinBeds] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [ownerOnly, setOwnerOnly] = useState(false);
  const [skipRecent, setSkipRecent] = useState(true);
  const [stateConfirmOpen, setStateConfirmOpen] = useState(false);

  const [stateState, stateAction, statePending] = useActionState<RunState, FormData>(
    runStateSearch,
    undefined,
  );

  const stateFormRef = useRef<HTMLFormElement>(null);

  // --- URL (advanced) mode state ---
  const [urlState, urlAction, urlPending] = useActionState<RunState, FormData>(
    runSearch,
    undefined,
  );
  const [configId, setConfigId] = useState(configs[0]?.id ?? "");
  const [maxItems, setMaxItems] = useState(100);
  const [urlConfirmOpen, setUrlConfirmOpen] = useState(false);
  const urlFormRef = useRef<HTMLFormElement>(null);

  const selectedConfig = useMemo(
    () => configs.find((c) => c.id === configId),
    [configId, configs],
  );
  const relevantCreds = useMemo(
    () => credentials.filter((c) => c.provider === (selectedConfig?.provider ?? "")),
    [credentials, selectedConfig],
  );

  // Polling for state search
  const startedId = stateState?.searchId || urlState?.searchId;
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!startedId) return;
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/searches/${startedId}/status`);
        const data = await res.json();
        if (!active) return;
        setStatus(data.status);
        if (["succeeded", "failed", "aborted", "partial"].includes(data.status)) {
          router.refresh();
          return;
        }
      } catch { /* keep polling */ }
      if (active) setTimeout(tick, 3000);
    };
    const t = setTimeout(tick, 2000);
    return () => { active = false; clearTimeout(t); };
  }, [startedId, router]);

  const stateEstCost = selectedStates.length * maxPerState * APPROX_COST_PER_RESULT;
  const urlEstCost = maxItems * APPROX_COST_PER_RESULT;

  const activeState = mode === "states" ? stateState : urlState;

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "states" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("states")}
        >
          Search by States
        </Button>
        <Button
          type="button"
          variant={mode === "url" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("url")}
        >
          Advanced (URL)
        </Button>
      </div>

      {/* ============ STATES MODE ============ */}
      {mode === "states" && (
        <>
          <form ref={stateFormRef} action={stateAction} className="space-y-4">
            <input type="hidden" name="states" value={JSON.stringify(selectedStates)} />
            <input type="hidden" name="maxPerState" value={maxPerState} />
            <input type="hidden" name="minBeds" value={minBeds} />
            <input type="hidden" name="maxRent" value={maxRent} />
            <input type="hidden" name="ownerOnly" value={ownerOnly ? "1" : ""} />
            <input type="hidden" name="skipRecent" value={skipRecent ? "1" : ""} />
            <input type="hidden" name="actorConfigId" value={configs[0]?.id ?? ""} />

            <StateSelector
              selected={selectedStates}
              onChange={setSelectedStates}
              recentlySearched={recentlySearched}
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="maxPerState">Max results per state</Label>
                <Input
                  id="maxPerState"
                  type="number"
                  min={1}
                  max={2000}
                  value={maxPerState}
                  onChange={(e) => setMaxPerState(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="minBeds">Min bedrooms</Label>
                <Input
                  id="minBeds"
                  type="number"
                  min={0}
                  placeholder="Any"
                  value={minBeds}
                  onChange={(e) => setMinBeds(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxRent">Max monthly rent</Label>
                <Input
                  id="maxRent"
                  type="number"
                  min={0}
                  placeholder="No limit"
                  value={maxRent}
                  onChange={(e) => setMaxRent(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="credState">Credential</Label>
                <Select id="credState" name="credentialId" defaultValue="auto">
                  <option value="auto">Auto (most headroom)</option>
                  {credentials
                    .filter((c) => c.provider === "apify")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}{c.remaining != null ? ` (${c.remaining} left)` : ""}
                      </option>
                    ))}
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={ownerOnly}
                  onChange={() => setOwnerOnly(!ownerOnly)}
                />
                Owner-listed only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={skipRecent}
                  onChange={() => setSkipRecent(!skipRecent)}
                />
                Skip states searched recently
              </label>
            </div>

            {activeState?.error && (
              <p className="text-sm text-destructive">{activeState.error}</p>
            )}
            {activeState?.success && (
              <p className="text-sm text-green-500">
                {activeState.success} Status: {status ?? "running"}.
              </p>
            )}

            <Button
              type="button"
              disabled={statePending || selectedStates.length === 0}
              onClick={() => setStateConfirmOpen(true)}
            >
              {statePending ? "Starting..." : `Search ${selectedStates.length} States`}
            </Button>
          </form>

          <Dialog open={stateConfirmOpen} onOpenChange={setStateConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm state search</DialogTitle>
                <DialogDescription>
                  Searching {selectedStates.length} states · up to{" "}
                  {selectedStates.length * maxPerState} results · Est. max cost:{" "}
                  {formatUSD(stateEstCost)}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStateConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={statePending}
                  onClick={() => {
                    setStateConfirmOpen(false);
                    stateFormRef.current?.requestSubmit();
                  }}
                >
                  Confirm &amp; run
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ============ URL (ADVANCED) MODE ============ */}
      {mode === "url" && (
        <>
          <form ref={urlFormRef} action={urlAction} className="space-y-4">
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
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input id="name" name="name" placeholder="Miami 2BR rentals" />
              </div>
            </div>

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
                      {c.label}{c.remaining != null ? ` (${c.remaining} left)` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <input type="hidden" name="params" id="params-json" value="{}" />

            {urlState?.error && (
              <p className="text-sm text-destructive">{urlState.error}</p>
            )}
            {urlState?.success && (
              <p className="text-sm text-green-500">
                {urlState.success}
                {urlState.credentialLabel ? ` Using: ${urlState.credentialLabel}.` : ""}
                {` Status: ${status ?? "running"}.`}
              </p>
            )}

            <Button
              type="button"
              disabled={urlPending}
              onClick={() => {
                const fd = new FormData(urlFormRef.current!);
                const params: Record<string, string> = {};
                for (const [k, v] of fd.entries()) {
                  if (k.startsWith("field_")) params[k.slice(6)] = String(v);
                }
                (document.getElementById("params-json") as HTMLInputElement).value =
                  JSON.stringify(params);
                setUrlConfirmOpen(true);
              }}
            >
              {urlPending ? "Starting..." : "Run"}
            </Button>
          </form>

          <Dialog open={urlConfirmOpen} onOpenChange={setUrlConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm run</DialogTitle>
                <DialogDescription>
                  Up to {maxItems} results · Est. max cost: {formatUSD(urlEstCost)}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUrlConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={urlPending}
                  onClick={() => {
                    setUrlConfirmOpen(false);
                    urlFormRef.current?.requestSubmit();
                  }}
                >
                  Confirm &amp; run
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
