import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const profile = await requireProfile();

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${profile.username}.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Searches
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Results
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly usage
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">—</CardContent>
        </Card>
      </div>
    </div>
  );
}
