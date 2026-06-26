"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Mark one notification read. RLS limits updates to the user's own rows.
export async function markNotificationRead(id: string): Promise<void> {
  await requireProfile();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", id);
  revalidatePath("/notifications");
}

// Mark every unread notification of the current user read.
export async function markAllRead(): Promise<void> {
  const me = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("recipient_id", me.id)
    .eq("read", false);
  revalidatePath("/notifications");
}
