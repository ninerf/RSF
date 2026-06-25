import { PageHeader } from "@/components/page-header";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSettings } from "@/lib/budget";
import type { ActorConfig, ApiCredential, Search } from "@/lib/types";
import {
  NewSearchForm,
  type ActorConfigOption,
  type CredentialOption,
} from "./new-search-form";
import { EnrichForm } from "./enrich-form";
import { rerunSearch, cancelSearch } from "./actions";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  succeeded: "default",
  running: "secondary",
  pending: "secondary",
  failed: "destructive",
  aborted: "destructive",
};

export default async function SearchesPage() {
  const profile = await requireProfile();
  const canRun = profile.role === "admin" || profile.can_run_searches;

  // Searches are readable by all authenticated users (RLS); use the
  // request-scoped client so RLS applies.
  const supabase = await createClient();
  const { data: searchData } = await supabase
    .from("searches")
    .select("*")
    .order("created_at", { ascending: false });
  const searches = (searchData as Search[]) ?? [];

  // Config + credential options are admin-managed; only fetch for runners.
  let configOptions: ActorConfigOption[] = [];
  let credentialOptions: CredentialOption[] = [];
  let strProvider = "apify_airbnb";
  let recentlySearched: Record<string, string> = {};

  if (canRun) {
    const admin = createAdminClient();
    const [{ data: configs }, { data: creds }, settings] = await Promise.all([
      admin.from("actor_configs").select("*").eq("active", true),
      admin.from("api_credentials").select("*").eq("active", true),
      getSettings(),
    ]);
    strProvider = settings.str_provider;

    // Fetch recently searched states (gracefully handles missing table).
    try {
      const { data: recentRuns } = await admin
        .from("search_state_runs")
        .select("state_code, finished_at")
        .eq("status", "succeeded")
        .order("finished_at", { ascending: false });

      const now = Date.now();
      const seen = new Set<string>();
      for (const r of (recentRuns ?? []) as { state_code: string; finished_at: string }[]) {
        if (seen.has(r.state_code)) continue;
        seen.add(r.state_code);
        const days = Math.floor((now - new Date(r.finished_at).getTime()) / 86400000);
        recentlySearched[r.state_code] = days === 0 ? "today" : `${days}d ago`;
      }
    } catch {
      // Table doesn't exist yet — migration 0006 not applied. Continue without it.
    }

    configOptions = ((configs as ActorConfig[]) ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
      input_mode: c.input_mode,
      input_fields: (c.input_fields as ActorConfigOption["input_fields"]) ?? [],
    }));

    credentialOptions = ((creds as ApiCredential[]) ?? []).map((c) => ({
      id: c.id,
      label: c.label,
      provider: c.provider,
      remaining:
        c.monthly_result_limit != null
          ? c.monthly_result_limit - c.results_used
          : null,
    }));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Searches"
        description="Run scraper jobs and enrich results with STR revenue."
      />

      {canRun && configOptions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>New search</CardTitle>
          </CardHeader>
          <CardContent>
            <NewSearchForm
              configs={configOptions}
              credentials={credentialOptions}
              recentlySearched={recentlySearched}
            />
          </CardContent>
        </Card>
      )}

      {canRun && configOptions.length === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No active data sources. Add one under Data Sources first.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Saved searches</CardTitle>
          <form action={async () => { "use server"; revalidatePath("/searches"); }}>
            <Button type="submit" variant="outline" size="sm">Refresh</Button>
          </form>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Created</TableHead>
                {canRun && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {searches.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canRun ? 5 : 4}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No searches yet.
                  </TableCell>
                </TableRow>
              ) : (
                searches.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link href={`/searches/${s.id}`} className="hover:underline">
                        {s.name ?? "Untitled"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>
                        {s.status}
                      </Badge>
                      {s.error && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {s.error}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{s.result_count}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString()}
                    </TableCell>
                    {canRun && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-3">
                          {(s.status === "succeeded" || s.status === "aborted") && s.result_count > 0 && (
                            <EnrichForm
                              searchId={s.id}
                              defaultProvider={strProvider}
                            />
                          )}
                          {(s.status === "running" || s.status === "pending") && (
                            <form action={cancelSearch}>
                              <input type="hidden" name="search_id" value={s.id} />
                              <Button type="submit" size="sm" variant="destructive">
                                Cancel
                              </Button>
                            </form>
                          )}
                          <form action={rerunSearch}>
                            <input
                              type="hidden"
                              name="search_id"
                              value={s.id}
                            />
                            <Button type="submit" size="sm" variant="ghost">
                              Re-run
                            </Button>
                          </form>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
