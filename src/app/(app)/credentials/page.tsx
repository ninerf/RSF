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
import type { ApiCredential } from "@/lib/types";
import { CreateCredentialForm } from "./create-credential-form";
import { deleteCredential, updateCredential } from "./actions";
import { Input } from "@/components/ui/input";

export default async function CredentialsPage() {
  await requireAdmin();
  const admin = createAdminClient();
  // Note: vault_secret_id is metadata only; the token itself is never selected.
  const { data } = await admin
    .from("api_credentials")
    .select(
      "id, provider, label, is_paid, monthly_result_limit, results_used, calls_used, active, created_at, vault_secret_id, last_reset",
    )
    .order("created_at", { ascending: true });

  const creds = (data as ApiCredential[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Credentials"
        description="Provider API tokens are encrypted in Supabase Vault and never displayed again."
      />

      <Card>
        <CardHeader>
          <CardTitle>Add credential</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateCredentialForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stored credentials</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creds.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No credentials yet.
                  </TableCell>
                </TableRow>
              ) : (
                creds.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.provider}</TableCell>
                    <TableCell>
                      <form action={updateCredential} className="flex items-center gap-1">
                        <input type="hidden" name="credential_id" value={c.id} />
                        <Input name="label" defaultValue={c.label} className="h-7 w-32 text-xs" />
                        <Input name="monthly_result_limit" defaultValue={c.monthly_result_limit ?? ""} placeholder="∞" className="h-7 w-16 text-xs" type="number" />
                        <Button type="submit" size="sm" variant="ghost" className="h-7 text-xs">Save</Button>
                      </form>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.is_paid ? "default" : "secondary"}>
                        {c.is_paid ? "paid" : "free"}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.monthly_result_limit ?? "∞"}</TableCell>
                    <TableCell>{c.results_used}</TableCell>
                    <TableCell className="text-right">
                      <form action={deleteCredential} className="inline">
                        <input
                          type="hidden"
                          name="credential_id"
                          value={c.id}
                        />
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
