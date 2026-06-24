"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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

export function ResultsView({ rows }: { rows: ResultView[] }) {
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [city, setCity] = useState("");
  const [listingType, setListingType] = useState("");
  const [verdict, setVerdict] = useState("");
  const [sort, setSort] = useState<SortKey>("spread");
  const [page, setPage] = useState(0);

  const cities = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.city).filter(Boolean))).sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    const out = rows.filter((r) => {
      if (minPrice && (r.price ?? 0) < Number(minPrice)) return false;
      if (maxPrice && (r.price ?? Infinity) > Number(maxPrice)) return false;
      if (beds && (r.beds ?? 0) < Number(beds)) return false;
      if (baths && (r.baths ?? 0) < Number(baths)) return false;
      if (city && r.city !== city) return false;
      if (listingType && r.listing_type !== listingType) return false;
      if (verdict && r.deal_verdict !== verdict) return false;
      return true;
    });

    out.sort((a, b) => {
      const get = (r: ResultView) => {
        switch (sort) {
          case "spread":
            return r.arbitrage_spread ?? -Infinity;
          case "str_revenue":
            return r.str_monthly_revenue ?? -Infinity;
          case "rent":
            return r.price ?? -Infinity;
          case "days_on_market":
            return r.days_on_market ?? Infinity;
        }
      };
      const av = get(a);
      const bv = get(b);
      // days_on_market ascending; others descending.
      return sort === "days_on_market" ? av - bv : bv - av;
    });

    return out;
  }, [rows, minPrice, maxPrice, beds, baths, city, listingType, verdict, sort]);

  const listingTypes = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.listing_type).filter(Boolean)),
      ).sort() as string[],
    [rows],
  );

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset to first page when filters change.
  const resetPage = () => setPage(0);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="minPrice">Min rent</Label>
            <Input
              id="minPrice"
              type="number"
              value={minPrice}
              onChange={(e) => {
                setMinPrice(e.target.value);
                resetPage();
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="maxPrice">Max rent</Label>
            <Input
              id="maxPrice"
              type="number"
              value={maxPrice}
              onChange={(e) => {
                setMaxPrice(e.target.value);
                resetPage();
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="beds">Min beds</Label>
            <Input
              id="beds"
              type="number"
              value={beds}
              onChange={(e) => {
                setBeds(e.target.value);
                resetPage();
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="baths">Min baths</Label>
            <Input
              id="baths"
              type="number"
              value={baths}
              onChange={(e) => {
                setBaths(e.target.value);
                resetPage();
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="city">City</Label>
            <Select
              id="city"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                resetPage();
              }}
            >
              <option value="">All</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="listingType">Listing type</Label>
            <Select
              id="listingType"
              value={listingType}
              onChange={(e) => {
                setListingType(e.target.value);
                resetPage();
              }}
            >
              <option value="">All</option>
              {listingTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="verdict">Verdict</Label>
            <Select
              id="verdict"
              value={verdict}
              onChange={(e) => {
                setVerdict(e.target.value);
                resetPage();
              }}
            >
              <option value="">All</option>
              <option value="Good">Good</option>
              <option value="Marginal">Marginal</option>
              <option value="Poor">Poor</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sort">Sort by</Label>
            <Select
              id="sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
            >
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
                // eslint-disable-next-line @next/next/no-img-element -- remote Zillow CDN hosts vary; plain img avoids per-host config and optimization cost
                <img
                  src={r.image_url}
                  alt={r.address ?? "Listing"}
                  className="h-40 w-full object-cover"
                />
              ) : (
                <div className="flex h-40 w-full items-center justify-center bg-secondary text-xs text-muted-foreground">
                  No image
                </div>
              )}
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">
                    {r.address ?? "Address unavailable"}
                  </div>
                  {r.deal_verdict && (
                    <Badge variant={VERDICT_VARIANT[r.deal_verdict]}>
                      {r.deal_verdict}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.city}
                  {r.state ? `, ${r.state}` : ""} · {formatNum(r.beds)} bd ·{" "}
                  {formatNum(r.baths)} ba
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-sm">
                  <span className="text-muted-foreground">Rent</span>
                  <span className="text-right">{formatUSD(r.price)}/mo</span>

                  <span className="text-muted-foreground">STR rev</span>
                  <span className="text-right">
                    {formatUSD(r.str_monthly_revenue)}/mo
                  </span>

                  <span className="text-muted-foreground">STR annual</span>
                  <span className="text-right">
                    {formatUSD(r.str_annual_revenue)}
                  </span>

                  <span className="text-muted-foreground">Spread</span>
                  <span
                    className={
                      "text-right " +
                      ((r.arbitrage_spread ?? 0) >= 0
                        ? "text-green-500"
                        : "text-destructive")
                    }
                  >
                    {formatUSD(r.arbitrage_spread)}/mo
                  </span>

                  {(r.str_adr != null || r.str_occupancy != null) && (
                    <>
                      <span className="text-muted-foreground">ADR / occ</span>
                      <span className="text-right">
                        {formatUSD(r.str_adr)} / {formatPct(r.str_occupancy)}
                      </span>
                    </>
                  )}
                </div>

                {r.legality_note && (
                  <p className="rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
                    STR note: {r.legality_note}
                  </p>
                )}

                {r.detail_url && (
                  <Link
                    href={r.detail_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block pt-1 text-sm text-primary underline-offset-4 hover:underline"
                  >
                    Open listing ↗
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
