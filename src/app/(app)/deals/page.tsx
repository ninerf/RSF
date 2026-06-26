import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ResultRow, ResultEnrichment } from "@/lib/types";
import { DealsView, type DealView } from "./deals-view";

// A property reaches the client board only when a worker approved it AND it has
// a contact name + number AND a Good STR verdict. "flagged" stays visible so
// the client can see their own flag took effect.
const CLIENT_STATUSES = new Set(["approved", "ready_to_send", "flagged"]);

export default async function DealsPage() {
  const me = await requireProfile();
  const supabase = await createClient();

  const [{ data: resultData }, { data: enrichData }] = await Promise.all([
    supabase
      .from("results")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(2000),
    supabase.from("result_enrichment").select("*"),
  ]);

  const results = (resultData as ResultRow[]) ?? [];
  const enrichments = (enrichData as ResultEnrichment[]) ?? [];
  const enrichmentById = new Map(enrichments.map((e) => [e.result_id, e]));

  const rows: DealView[] = results
    .filter((r) => {
      if (r.archived) return false;
      if (!CLIENT_STATUSES.has(r.review_status)) return false;
      if (!r.owner_name || !r.contact_phone) return false;
      const e = enrichmentById.get(r.id);
      return e?.deal_verdict === "Good";
    })
    .map((r) => {
      const e = enrichmentById.get(r.id);
      return {
        id: r.id,
        address: r.address,
        city: r.city,
        state: r.state,
        price: r.price,
        beds: r.beds,
        baths: r.baths,
        image_url: r.image_url,
        detail_url: r.detail_url,
        owner_name: r.owner_name,
        contact_phone: r.contact_phone,
        contact_email: r.contact_email,
        availability_status: r.availability_status,
        review_status: r.review_status,
        flag_note: r.flag_note,
        str_monthly_revenue: e?.str_monthly_revenue ?? null,
        str_annual_revenue: e?.str_annual_revenue ?? null,
        arbitrage_spread: e?.arbitrage_spread ?? null,
      };
    });

  const canAct = me.role === "client" || me.role === "admin";

  return (
    <div>
      <PageHeader
        title="Deals"
        description="Approved owner leads ready to contact. Mark ready-to-send, or flag any that shouldn't be here."
      />
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No approved deals yet. Workers approve good owner leads from the Results board.
          </CardContent>
        </Card>
      ) : (
        <DealsView rows={rows} canAct={canAct} />
      )}
    </div>
  );
}
