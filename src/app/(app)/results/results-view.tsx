"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatUSD, formatNum, formatPct } from "@/lib/format";
import type { DealVerdict } from "@/lib/types";

export interface ResultView {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  listing_type: string | null;
  detail_url: string | null;
  image_url: string | null;
  days_on_market: number | null;
  owner_name: string | null;
  owner_type: "owner" | "management" | null;
  contact_phone: string | null;
  contact_email: string | null;
  broker_name: string | null;
  str_monthly_revenue: number | null;
  str_annual_revenue: number | null;
  str_adr: number | null;
  str_occupancy: number | null;
  arbitrage_spread: number | null;
  deal_verdict: DealVerdict | null;
  legality_note: string | null;
}

const VERDICT_VARIANT: Record<DealVerdict, "default" | "secondary" | "destructive"> = {
  Good: "default",
  Marginal: "secondary",
  Poor: "destructive",
};

const PAGE_SIZE = 24;

type SortKey = "spread" | "str_revenue" | "rent" | "days_on_market";

function EnrichButton({ resultId }: { resultId: string }) {
  const [status, setStatus] = useState<"idle" | "starting" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (status === "done") return <span className="text-xs text-green-500">✓ Enriched</span>;

  const start = async () => {
    setStatus("starting");
    setError(null);
    try {
      const res = await fetch("/api/results/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); setStatus("error"); return; }
      if (data.status === "done") { setStatus("done"); router.refresh(); return; }

      const runId = data.runId;
      setStatus("running");
      const poll = async () => {
        const r = await fetch(`/api/results/enrich?resultId=${resultId}&runId=${runId}`);
        const d = await r.json();
        if (d.status === "running") { setTimeout(poll, 4000); return; }
        if (d.status === "done" && !d.error) { setStatus("done"); router.refresh(); }
        else { setError(d.error ?? "Failed"); setStatus("error"); }
      };
      setTimeout(poll, 6000);
    } catch { setError("Network error"); setStatus("error"); }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" className="text-xs h-7" disabled={status === "starting" || status === "running"} onClick={start}>
          {status === "starting" ? "Starting..." : status === "running" ? "Calculating..." : "Calculate STR"}
        </Button>
        <span className="text-[10px] text-muted-foreground">via Airbnb comps</span>
      </div>
      {error && <p className="text-xs text-destructive">{error.includes("memory") ? "Apify memory full — wait a few minutes and retry" : error}</p>}
    </div>
  );
}

export function ResultsView({ rows }: { rows: ResultView[] }) {
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [city, setCity] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [listingType, setListingType] = useState("");
  const [verdict, setVerdict] = useState("");
  const [ownerType, setOwnerType] = useState("");
  const [sort, setSort] = useState<SortKey>("spread");
  const [page, setPage] = useState(0);

  const cities = useMemo(
    () => Array.from(new Set(rows.map((r) => r.city).filter(Boolean))).sort() as string[],
    [rows],
  );

  const states = useMemo(
    () => Array.from(new Set(rows.map((r) => r.state).filter(Boolean))).sort() as string[],
    [rows],
  );

  const listingTypes = useMemo(
    () => Array.from(new Set(rows.map((r) => r.listing_type).filter(Boolean))).sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    const out = rows.filter((r) => {
      if (minPrice && (r.price ?? 0) < Number(minPrice)) return false;
      if (maxPrice && (r.price ?? Infinity) > Number(maxPrice)) return false;
      if (beds && (r.beds ?? 0) < Number(beds)) return false;
      if (baths && (r.baths ?? 0) < Number(baths)) return false;
      if (city && r.city !== city) return false;
      if (stateFilter && r.state !== stateFilter) return false;
      if (listingType && r.listing_type !== listingType) return false;
      if (verdict && r.deal_verdict !== verdict) return false;
      if (ownerType && r.owner_type !== ownerType) return false;
      return true;
    });

    out.sort((a, b) => {
      const get = (r: ResultView) => {
        switch (sort) {
          case "spread": return r.arbitrage_spread ?? -Infinity;
          case "str_revenue": return r.str_monthly_revenue ?? -Infinity;
          case "rent": return r.price ?? -Infinity;
          case "days_on_market": return r.days_on_market ?? Infinity;
        }
      };
      const av = get(a);
      const bv = get(b);
      return sort === "days_on_market" ? av - bv : bv - av;
    });

    return out;
  }, [rows, minPrice, maxPrice, beds, baths, city, stateFilter, listingType, verdict, ownerType, sort]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const resetPage = () => setPage(0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="minPrice">Min rent</Label>
            <Input id="minPrice" type="number" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); resetPage(); }} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="maxPrice">Max rent</Label>
            <Input id="maxPrice" type="number" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); resetPage(); }} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="beds">Min beds</Label>
            <Input id="beds" type="number" value={beds} onChange={(e) => { setBeds(e.target.value); resetPage(); }} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="baths">Min baths</Label>
            <Input id="baths" type="number" value={baths} onChange={(e) => { setBaths(e.target.value); resetPage(); }} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="stateFilter">State</Label>
            <Select id="stateFilter" value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); resetPage(); }}>
              <option value="">All</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="city">City</Label>
            <Select id="city" value={city} onChange={(e) => { setCity(e.target.value); resetPage(); }}>
              <option value="">All</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ownerType">Owner type</Label>
            <Select id="ownerType" value={ownerType} onChange={(e) => { setOwnerType(e.target.value); resetPage(); }}>
              <option value="">All</option>
              <option value="owner">Owner</option>
              <option value="management">Management</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="verdict">Verdict</Label>
            <Select id="verdict" value={verdict} onChange={(e) => { setVerdict(e.target.value); resetPage(); }}>
              <option value="">All</option>
              <option value="Good">Good</option>
              <option value="Marginal">Marginal</option>
              <option value="Poor">Poor</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="listingType">Listing type</Label>
            <Select id="listingType" value={listingType} onChange={(e) => { setListingType(e.target.value); resetPage(); }}>
              <option value="">All</option>
              {listingTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sort">Sort by</Label>
            <Select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="spread">Spread</option>
              <option value="str_revenue">STR revenue</option>
              <option value="rent">Rent</option>
              <option value="days_on_market">Days on market</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "result" : "results"}
      </p>

      {pageRows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No results match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageRows.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              {r.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image_url} alt={r.address ?? "Listing"} className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-secondary text-xs text-muted-foreground">No image</div>
              )}
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{r.address ?? "Address unavailable"}</div>
                  <div className="flex shrink-0 gap-1">
                    {r.owner_type && (
                      <Badge variant={r.owner_type === "owner" ? "default" : "secondary"}>
                        {r.owner_type === "owner" ? "Owner" : "Mgmt"}
                      </Badge>
                    )}
                    {r.deal_verdict && (
                      <Badge variant={VERDICT_VARIANT[r.deal_verdict]}>{r.deal_verdict}</Badge>
                    )}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  {r.city}{r.state ? `, ${r.state}` : ""} · {formatNum(r.beds)} bd · {formatNum(r.baths)} ba
                </div>

                {/* Owner / Contact info */}
                {(r.owner_name || r.contact_phone || r.contact_email) && (
                  <div className="rounded bg-secondary/50 px-2 py-1.5 text-xs space-y-0.5">
                    {r.owner_name && <div><span className="text-muted-foreground">Contact:</span> {r.owner_name}</div>}
                    {r.contact_phone && <div><span className="text-muted-foreground">Phone:</span> {r.contact_phone}</div>}
                    {r.contact_email && <div><span className="text-muted-foreground">Email:</span> {r.contact_email}</div>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-sm">
                  <span className="text-muted-foreground">Rent</span>
                  <span className="text-right">{formatUSD(r.price)}/mo</span>

                  <span className="text-muted-foreground">STR rev</span>
                  <span className="text-right">{formatUSD(r.str_monthly_revenue)}/mo</span>

                  <span className="text-muted-foreground">STR annual</span>
                  <span className="text-right">{formatUSD(r.str_annual_revenue)}</span>

                  <span className="text-muted-foreground">Spread</span>
                  <span className={"text-right " + ((r.arbitrage_spread ?? 0) >= 0 ? "text-green-500" : "text-destructive")}>
                    {formatUSD(r.arbitrage_spread)}/mo
                  </span>

                  {(r.str_adr != null || r.str_occupancy != null) && (
                    <>
                      <span className="text-muted-foreground">ADR / occ</span>
                      <span className="text-right">{formatUSD(r.str_adr)} / {formatPct(r.str_occupancy)}</span>
                    </>
                  )}
                </div>

                {r.legality_note && (
                  <p className="rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
                    STR note: {r.legality_note}
                  </p>
                )}

                {r.str_monthly_revenue == null && r.city && (
                  <EnrichButton resultId={r.id} />
                )}

                {r.detail_url ? (
                  <Link href={r.detail_url} target="_blank" rel="noopener noreferrer" className="inline-block pt-1 text-sm text-primary underline-offset-4 hover:underline">
                    {r.contact_phone || r.contact_email ? "View listing ↗" : "View listing for contact info ↗"}
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next</Button>
        </div>
      )}
    </div>
  );
}
