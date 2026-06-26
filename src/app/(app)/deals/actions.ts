"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyStaff } from "@/lib/notifications";

// Only clients and admins act on the deals board.
async function requireClient() {
  const profile = await requireProfile();
  if (profile.role !== "client" && profile.role !== "admin") {
    throw new Error("Not permitted.");
  }
  return profile;
}

// Client marks an approved deal ready to send to the owner.
export async function markReadyToSend(resultId: string): Promise<void> {
  await requireClient();
  const admin = createAdminClient();
  await admin
    .from("results")
    .update({ review_status: "ready_to_send" })
    .eq("id", resultId);
  revalidatePath("/deals");
  revalidatePath("/results");
}

// Client flags a wrongly-approved deal. Notifies all staff (admin + worker).
export async function flagResult(
  resultId: string,
  note: string,
): Promise<{ error?: string }> {
  const me = await requireClient();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("results")
    .select("address, city, state")
    .eq("id", resultId)
    .single();
  const result = row as { address: string | null; city: string | null; state: string | null } | null;

  await admin
    .from("results")
    .update({
      review_status: "flagged",
      flagged_by: me.id,
      flag_note: note.trim() || null,
    })
    .eq("id", resultId);

  const where = result
    ? [result.address, result.city, result.state].filter(Boolean).join(", ")
    : "a property";
  await notifyStaff({
    resultId,
    createdBy: me.id,
    type: "flag",
    message: `${me.username} flagged "${where}" as wrongly approved${
      note.trim() ? `: ${note.trim()}` : "."
    }`,
  });

  revalidatePath("/deals");
  revalidatePath("/results");
  return {};
}
