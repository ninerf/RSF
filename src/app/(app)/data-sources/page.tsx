import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActorConfig } from "@/lib/types";
import { CreateActorForm } from "./create-actor-form";
import { deleteActorConfig } from "./actions";

export default async function DataSourcesPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("actor_configs")
    .select("*")
    .order("created_at", { ascending: true });

  const configs = (data as ActorConfig[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Sources"
        description="Scraper actor configurations. Add rows directly with a JSON editor."
      />

      <Card>
        <CardHeader>
          <CardTitle>Add actor config</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateActorForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured sources</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Actor ID</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Country</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configs.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No data sources yet.
                  </TableCell>
                </TableRow>
              ) : (
                configs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.provider}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {c.actor_id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.input_mode}</Badge>
                    </TableCell>
                    <TableCell>{c.country ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <form action={deleteActorConfig} className="inline">
                        <input type="hidden" name="config_id" value={c.id} />
                        <Button
                          type="submit"
                          variant="destructive"
                          size="sm"
                        >
                          Delete
                        </Button>
                      </form>
                    </TableCell>
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
