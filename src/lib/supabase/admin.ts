import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requirePublicEnv } from "@/lib/env";

// Service-role client. Bypasses RLS entirely. ONLY import this from server
// actions / server-only modules after verifying the caller is an admin.
// The service role key is never sent to the browser.
export function createAdminClient() {
  const { url } = requirePublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. This must be set as a server-only " +
        "environment variable.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
