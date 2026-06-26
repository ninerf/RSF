"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUSD, formatNum } from "@/lib/format";
import { markReadyToSend, flagResult } from "./actions";
import type { ReviewStatus } from "@/lib/types";

export interface DealView {
  id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  image_url: string | null;
  detail_url: string | null;
  owner_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  availability_status: string | null;
  review_status: ReviewStatus;
  flag_note: string | null;
  str_monthly_revenue: number | null;
  str_annual_revenue: number | null;
  arbitrage_spread: number | null;
}

function DealCard({ r, canAct }: { r: DealView; canAct: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const [note, setNote] = useState("");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const isReady = r.review_status === "ready_to_send";
  const isFlagged = r.review_status === "flagged";

  return (
    <Card className="overflow-hidden">
      {r.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.image_url} alt={r.address ?? "Listing"} className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-secondary text-xs text-muted-foreground">No image</div>
      )}
      <CardContent className="space-y-2 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm font-medium">{r.address ?? "Address unavailable"}</div>
          {isReady && <Badge variant="default">Ready</Badge>}
          {isFlagged && <Badge variant="destructive">Flagged</Badge>}
        </div>

        <div className="text-xs text-muted-foreground">
          {r.city}{r.state ? `, ${r.state}` : ""} · {formatNum(r.beds)} bd · {formatNum(r.baths)} ba
        </div>

        {/* Owner contact (always present on this board) */}
        <div className="rounded bg-secondary/50 px-2 py-1.5 text-xs space-y-0.5">
          <div><span className="text-muted-foreground">Owner:</span> {r.owner_name}</div>
          <div><span className="text-muted-foreground">Phone:</span> {r.contact_phone}</div>
          {r.contact_email && <div><span className="text-muted-foreground">Email:</span> {r.contact_email}</div>}
          {r.availability_status && <div><span className="text-muted-foreground">Availability:</span> {r.availability_status}</div>}
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-sm">
          <span className="text-muted-foreground">Rent</span>
          <span className="text-right">{formatUSD(r.price)}/mo</span>
          <span className="text-muted-foreground">STR rev</span>
          <span className="text-right">{formatUSD(r.str_monthly_revenue)}/mo</span>
          <span className="text-muted-foreground">Spread</span>
          <span className={"text-right " + ((r.arbitrage_spread ?? 0) >= 0 ? "text-green-500" : "text-destructive")}>
            {formatUSD(r.arbitrage_spread)}/mo
          </span>
        </div>

        {isFlagged && r.flag_note && (
          <p className="rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">Flagged: {r.flag_note}</p>
        )}

        {r.detail_url && (
          <Link href={r.detail_url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary underline-offset-4 hover:underline">
            View listing ↗
          </Link>
        )}

        {canAct && (
          <div className="space-y-2 pt-1">
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 flex-1 text-xs"
                variant={isReady ? "default" : "outline"}
                disabled={busy || isReady}
                onClick={() => run(() => markReadyToSend(r.id))}
              >
                {isReady ? "✓ Ready to send" : "Mark ready to send"}
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                variant="outline"
                disabled={busy}
                onClick={() => setFlagging((f) => !f)}
              >
                ⚑ Flag
              </Button>
            </div>
            {flagging && (
              <div className="space-y-1">
                <Input
                  className="h-7 text-xs"
                  placeholder="Why is this wrongly approved?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 w-full text-xs"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await flagResult(r.id, note);
                      setFlagging(false);
                      setNote("");
                    })
                  }
                >
                  Submit flag (notifies team)
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DealsView({ rows, canAct }: { rows: DealView[]; canAct: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{rows.length} {rows.length === 1 ? "deal" : "deals"}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <DealCard key={r.id} r={r} canAct={canAct} />
        ))}
      </div>
    </div>
  );
}
