import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

export default async function SettingsPage() {
  const profile = await requireProfile();

  return (
    <div>
      <PageHeader title="Settings" description="Your account." />
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Username</span>
            <span>{profile.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span>{profile.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Can run searches</span>
            <span>{profile.can_run_searches ? "Yes" : "No"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
