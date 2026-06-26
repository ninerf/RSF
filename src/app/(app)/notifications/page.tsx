import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";
import { markNotificationRead, markAllRead } from "./actions";

export default async function NotificationsPage() {
  await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const notifications = (data as Notification[]) ?? [];
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Alerts from the team — flagged deals and review activity." />

      {hasUnread && (
        <form action={markAllRead}>
          <Button type="submit" variant="outline" size="sm">Mark all read</Button>
        </form>
      )}

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">No notifications.</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={n.read ? "opacity-60" : ""}>
              <CardContent className="flex items-center justify-between gap-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm">{n.message}</p>
                  <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {n.result_id && (
                    <a href="/results" className="text-xs text-primary underline-offset-4 hover:underline">View</a>
                  )}
                  {!n.read && (
                    <form action={markNotificationRead.bind(null, n.id)}>
                      <Button type="submit" variant="ghost" size="sm" className="h-7 text-xs">Mark read</Button>
                    </form>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
