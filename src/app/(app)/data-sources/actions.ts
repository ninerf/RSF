"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const BaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  provider: z.string().trim().min(1, "Provider is required"),
  actor_id: z.string().trim().min(1, "Actor ID is required"),
  source_label: z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
  input_mode: z.enum(["url", "form"]),
});

export type ActionState = { error?: string; success?: string } | undefined;

function parseJsonField(
  value: FormDataEntryValue | null,
  fallback: unknown,
): { ok: true; value: unknown } | { ok: false } {
  const raw = value ? String(value).trim() : "";
  if (raw === "") return { ok: true, value: fallback };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

export async function createActorConfig(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const base = BaseSchema.safeParse({
    name: formData.get("name"),
    provider: formData.get("provider"),
    actor_id: formData.get("actor_id"),
    source_label: formData.get("source_label") || null,
    country: formData.get("country") || null,
    input_mode: formData.get("input_mode"),
  });

  if (!base.success) {
    return { error: base.error.issues[0]?.message ?? "Invalid input." };
  }

  const template = parseJsonField(formData.get("input_template"), {});
  const fields = parseJsonField(formData.get("input_fields"), []);
  const mapping = parseJsonField(formData.get("result_mapping"), {});

  if (!template.ok || !fields.ok || !mapping.ok) {
    return {
      error:
        "One of the JSON fields is invalid. Check input_template, input_fields, and result_mapping.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("actor_configs").insert({
    ...base.data,
    input_template: template.value,
    input_fields: fields.value,
    result_mapping: mapping.value,
  });

  if (error) {
    return { error: "Could not save the actor config." };
  }

  revalidatePath("/data-sources");
  return { success: `Actor config "${base.data.name}" created.` };
}

export async function deleteActorConfig(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("config_id") ?? "");
  if (!id) return;

  const admin = createAdminClient();
  await admin.from("actor_configs").delete().eq("id", id);
  revalidatePath("/data-sources");
}
