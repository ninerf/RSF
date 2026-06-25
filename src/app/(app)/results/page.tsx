import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ResultRow, ResultEnrichment } from "@/lib/types";
import { ResultsView, type ResultView } from "./results-view";

interface LegalityNote {
  city: string;
  state: string;
  note: string;
}

export default async function ResultsPage() {
  await requireProfile();
  const supabase = await createClient();

  // All authenticated users can read results + enrichment (RLS).
  const [{ data: resultData }, { data: enrichData }, { data: legalityData }] =
    await Promise.all([
      supabase
        .from("results")
        .select("*")
        .eq("archived", false)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase.from("result_enrichment").select("*"),
      supabase.from("str_legality_notes").select("city, state, note"),
    ]);

  const results = (resultData as ResultRow[]) ?? [];
  const enrichments = (enrichData as ResultEnrichment[]) ?? [];
  const legality = (legalityData as LegalityNote[]) ?? [];

  const enrichmentById = new Map(enrichments.map((e) => [e.result_id, e]));
  const legalityByCity = new Map(
    legality.map((l) => [`${l.city?.toLowerCase()}|${l.state?.toLowerCase()}`, l.note]),
  );

  const rows: ResultView[] = results.map((r) => {
    const e = enrichmentById.get(r.id);
    const note =
      r.city && r.state
        ? legalityByCity.get(`${r.city.toLowerCase()}|${r.state.toLowerCase()}`) ?? null
        : null;
    return {
      id: r.id,
      address: r.address,
      city: r.city,
      state: r.state,
      price: r.price,
      beds: r.beds,
      baths: r.baths,
      listing_type: r.listing_type,
      detail_url: r.detail_url,
      image_url: r.image_url,
      days_on_market: r.days_on_market,
      owner_name: r.owner_name,
      owner_type: r.owner_type,
      contact_phone: r.contact_phone,
      contact_email: r.contact_email,
      broker_name: r.broker_name,
      str_monthly_revenue: e?.str_monthly_revenue ?? null,
      str_annual_revenue: e?.str_annual_revenue ?? null,
      str_adr: e?.str_adr ?? null,
      str_occupancy: e?.str_occupancy ?? null,
      arbitrage_spread: e?.arbitrage_spread ?? null,
      deal_verdict: e?.deal_verdict ?? null,
      legality_note: note,
    };
  });

  return (
    <div>
      <PageHeader
        title="Results"
        description="Normalized listings with STR-revenue valuation and deal verdicts."
      />
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No results yet. Run a search to populate listings.
          </CardContent>
        </Card>
      ) : (
        <ResultsView rows={rows} />
      )}
    </div>
  );
}
