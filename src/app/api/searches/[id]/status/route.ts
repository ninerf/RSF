import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { pollSearch } from "@/lib/search-engine";

// Polls an in-flight search. Auth required. On terminal status it returns the
// finalized row (results are upserted + usage recorded inside pollSearch).
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const search = await pollSearch(id);
    return NextResponse.json({
      id: search.id,
      status: search.status,
      result_count: search.result_count,
      error: search.error,
      apify_run_id: search.apify_run_id,
      finished_at: search.finished_at,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Poll failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
