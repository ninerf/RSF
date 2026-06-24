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
import type { Profile } from "@/lib/types";
import { CreateUserForm } from "./create-user-form";
import { deleteUser } from "./actions";

export default async function UsersPage() {
  const me = await requireAdmin();
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  const users = (data as Profile[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Create and manage accounts. Only admins can do this."
      />

      <Card>
        <CardHeader>
          <CardTitle>Create user</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateUserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Can run searches</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell>
                    <Badge
                      variant={u.role === "admin" ? "default" : "secondary"}
                    >
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{u.can_run_searches ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right">
                    {u.id !== me.id ? (
                      <form action={deleteUser} className="inline">
                        <input type="hidden" name="user_id" value={u.id} />
                        <Button
                          type="submit"
                          variant="destructive"
                          size="sm"
                        >
                          Delete
                        </Button>
                      </form>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        you
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
