import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { pollSearch } from "@/lib/search-engine";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  try {
    const search = await pollSearch(id);
    const supabase = await createClient();

    // Get sub-run progress
    const { data: runs } = await supabase
      .from("search_state_runs")
      .select("state_code, status, result_count")
      .eq("search_id", id);

    const stateRuns = (runs ?? []) as { state_code: string; status: string; result_count: number }[];
    const completed = stateRuns.filter((r) => r.status === "succeeded").length;
    const failed = stateRuns.filter((r) => r.status === "failed").length;
    const total = stateRuns.filter((r) => r.status !== "skipped").length;
    const current = stateRuns.find((r) => r.status === "running");
    const totalResults = stateRuns.reduce((s, r) => s + r.result_count, 0);

    return NextResponse.json({
      id: search.id,
      status: search.status,
      result_count: totalResults,
      error: search.error,
      finished_at: search.finished_at,
      progress: {
        completed,
        failed,
        total,
        current_state: current?.state_code ?? null,
        results_so_far: totalResults,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Poll failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
