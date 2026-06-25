import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

type LogLevel = "info" | "warn" | "error" | "debug";

export async function logSearch(
  searchId: string,
  level: LogLevel,
  message: string,
  stateCode?: string | null,
  metadata?: Record<string, unknown>,
) {
  const admin = createAdminClient();
  await admin.from("search_logs").insert({
    search_id: searchId,
    level,
    message,
    state_code: stateCode ?? null,
    metadata: metadata ?? null,
  });
}
