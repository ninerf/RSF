import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { getSettings } from "@/lib/budget";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const profile = await requireProfile();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your account and app configuration." />

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

      {profile.role === "admin" && (
        <Card>
          <CardHeader>
            <CardTitle>App settings</CardTitle>
          </CardHeader>
          <CardContent>
            <SettingsForm settings={await getSettings()} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
