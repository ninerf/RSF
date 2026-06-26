import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Fan a notification out to every staff member (admin + worker). Used when a
// client flags a wrongly-approved property. One row per recipient so each
// person can mark their own copy read.
export async function notifyStaff(opts: {
  resultId: string;
  message: string;
  createdBy: string;
  type?: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: staff } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["admin", "worker"]);

  const recipients = (staff as { id: string }[]) ?? [];
  if (recipients.length === 0) return;

  const rows = recipients.map((r) => ({
    recipient_id: r.id,
    result_id: opts.resultId,
    type: opts.type ?? "flag",
    message: opts.message,
    created_by: opts.createdBy,
  }));

  await admin.from("notifications").insert(rows);
}
