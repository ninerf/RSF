import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function ResultsPage() {
  return (
    <div>
      <PageHeader
        title="Results"
        description="Normalized property listings from your searches."
      />
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No results yet. Listings populate once searches run.
        </CardContent>
      </Card>
    </div>
  );
}
