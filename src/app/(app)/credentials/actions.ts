"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const CreateCredentialSchema = z.object({
  provider: z.string().trim().min(1, "Provider is required"),
  label: z.string().trim().min(1, "Label is required"),
  token: z.string().trim().min(1, "Token is required"),
  is_paid: z.boolean(),
  monthly_result_limit: z.number().int().positive().nullable(),
});

export type ActionState = { error?: string; success?: string } | undefined;

export async function createCredential(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const rawLimit = formData.get("monthly_result_limit");
  const parsed = CreateCredentialSchema.safeParse({
    provider: formData.get("provider"),
    label: formData.get("label"),
    token: formData.get("token"),
    is_paid: formData.get("is_paid") === "on",
    monthly_result_limit:
      rawLimit && String(rawLimit).trim() !== ""
        ? Number(rawLimit)
        : null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const { provider, label, token, is_paid, monthly_result_limit } =
    parsed.data;

  const admin = createAdminClient();

  // Store the token in Vault (encrypted at rest). We only keep the secret id.
  const { data: secretId, error: vaultErr } = await admin.rpc(
    "vault_store_secret",
    {
      secret: token,
      name: `cred_${provider}_${label}_${Date.now()}`,
      description: `API token for ${provider} (${label})`,
    },
  );

  if (vaultErr || !secretId) {
    return { error: "Could not securely store the token." };
  }

  const { error: insertErr } = await admin.from("api_credentials").insert({
    provider,
    label,
    vault_secret_id: secretId,
    is_paid,
    monthly_result_limit,
  });

  if (insertErr) {
    // Clean up the orphaned secret.
    await admin.rpc("vault_delete_secret", { secret_id: secretId });
    return { error: "Could not save the credential." };
  }

  revalidatePath("/credentials");
  return { success: `Credential "${label}" stored.` };
}

export async function deleteCredential(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("credential_id") ?? "");
  if (!id) return;

  const admin = createAdminClient();

  // Look up the vault secret id so we can delete the secret too.
  const { data: cred } = await admin
    .from("api_credentials")
    .select("vault_secret_id")
    .eq("id", id)
    .single();

  await admin.from("api_credentials").delete().eq("id", id);

  if (cred?.vault_secret_id) {
    await admin.rpc("vault_delete_secret", {
      secret_id: cred.vault_secret_id,
    });
  }

  revalidatePath("/credentials");
}

export async function updateCredential(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("credential_id") ?? "");
  if (!id) return;

  const label = String(formData.get("label") ?? "").trim();
  const rawLimit = formData.get("monthly_result_limit");
  const monthly_result_limit =
    rawLimit && String(rawLimit).trim() !== "" ? Number(rawLimit) : null;

  const admin = createAdminClient();
  await admin
    .from("api_credentials")
    .update({ label, monthly_result_limit })
    .eq("id", id);

  revalidatePath("/credentials");
}
