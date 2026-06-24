import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { ApiCredential } from "@/lib/types";

// Reads a provider token from Vault. Server-only. Never log or return this to
// the client.
export async function readToken(vaultSecretId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("vault_read_secret", {
    secret_id: vaultSecretId,
  });
  if (error || !data) return null;
  return data as string;
}

// Monthly reset: if last_reset is in a prior calendar month, zero the counters.
async function maybeResetCredential(cred: ApiCredential): Promise<ApiCredential> {
  const now = new Date();
  const last = new Date(cred.last_reset);
  const sameMonth =
    last.getUTCFullYear() === now.getUTCFullYear() &&
    last.getUTCMonth() === now.getUTCMonth();

  if (sameMonth) return cred;

  const admin = createAdminClient();
  const today = now.toISOString().slice(0, 10);
  const { data } = await admin
    .from("api_credentials")
    .update({ results_used: 0, calls_used: 0, last_reset: today })
    .eq("id", cred.id)
    .select("*")
    .single();

  return (data as ApiCredential) ?? { ...cred, results_used: 0, calls_used: 0 };
}

function remainingHeadroom(cred: ApiCredential): number {
  if (cred.monthly_result_limit == null) return Number.POSITIVE_INFINITY;
  return cred.monthly_result_limit - cred.results_used;
}

export interface CredentialSelection {
  credential: ApiCredential;
  token: string;
}

export interface SelectionError {
  error: string;
}

// Pick an active credential for a provider with the most remaining headroom.
// Optionally force a specific credential id (manual override from the UI).
export async function selectCredential(
  provider: string,
  forceCredentialId?: string | null,
): Promise<CredentialSelection | SelectionError> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("api_credentials")
    .select("*")
    .eq("provider", provider)
    .eq("active", true);

  let creds = (data as ApiCredential[]) ?? [];
  if (creds.length === 0) {
    return { error: `No active credential for provider "${provider}".` };
  }

  // Apply monthly resets before evaluating headroom.
  creds = await Promise.all(creds.map(maybeResetCredential));

  let chosen: ApiCredential | undefined;
  if (forceCredentialId) {
    chosen = creds.find((c) => c.id === forceCredentialId);
    if (!chosen) {
      return { error: "The selected credential is not active or not found." };
    }
  } else {
    chosen = creds.sort(
      (a, b) => remainingHeadroom(b) - remainingHeadroom(a),
    )[0];
  }

  const token = await readToken(chosen.vault_secret_id);
  if (!token) {
    return { error: "Could not read the credential token from Vault." };
  }

  return { credential: chosen, token };
}
