import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Returns the next un-enriched result ID for batch processing.
// The client calls this repeatedly, one at a time, to avoid RAM issues.
export async function GET(req: NextRequest) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Count total un-enriched results
  const { count } = await admin
    .from("results")
    .select("id", { count: "exact", head: true })
    .is("archived", null)  // handles both false and missing column
    .not("city", "is", null);

  // Find results without enrichment
  const { data } = await admin
    .from("results")
    .select("id, city, state, beds")
    .not("city", "is", null)
    .not("id", "in", `(select result_id from result_enrichment where str_monthly_revenue is not null)`)
    .limit(1);

  // Fallback: left join approach
  const { data: unenriched } = await admin.rpc("get_unenriched_count");

  // Simple approach: get all result IDs, then check which have enrichment
  const { data: allResults } = await admin
    .from("results")
    .select("id")
    .not("city", "is", null)
    .limit(2000);

  const { data: enriched } = await admin
    .from("result_enrichment")
    .select("result_id")
    .not("str_monthly_revenue", "is", null);

  const enrichedIds = new Set((enriched ?? []).map((e: { result_id: string }) => e.result_id));
  const pending = (allResults ?? []).filter((r: { id: string }) => !enrichedIds.has(r.id));

  return NextResponse.json({
    total: allResults?.length ?? 0,
    enriched: enrichedIds.size,
    pending: pending.length,
    nextId: pending[0]?.id ?? null,
  });
}
