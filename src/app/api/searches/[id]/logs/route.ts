import { NextResponse, type NextRequest } from "next/server";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const since = req.nextUrl.searchParams.get("since");

  const supabase = await createClient();

  // Fetch logs
  let query = supabase
    .from("search_logs")
    .select("id, level, message, state_code, metadata, created_at")
    .eq("search_id", id)
    .order("created_at", { ascending: true });

  if (since) query = query.gt("created_at", since);

  const { data: logs } = await query;

  // Fetch search status
  const { data: search } = await supabase
    .from("searches")
    .select("status, result_count, search_mode")
    .eq("id", id)
    .single();

  // Fetch state run progress
  const { data: runs } = await supabase
    .from("search_state_runs")
    .select("state_code, status, result_count")
    .eq("search_id", id);

  const stateRuns = (runs ?? []) as { state_code: string; status: string; result_count: number }[];
  const completed = stateRuns.filter((r) => r.status === "succeeded").length;
  const total = stateRuns.length;
  const current = stateRuns.find((r) => r.status === "running");

  return NextResponse.json({
    logs: logs ?? [],
    search: search ?? { status: "unknown", result_count: 0 },
    progress: { completed, total, current_state: current?.state_code ?? null },
    states: stateRuns,
  });
}
