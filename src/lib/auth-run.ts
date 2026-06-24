import "server-only";

import { requireProfile } from "@/lib/auth";
import type { Profile } from "@/lib/types";

// Gate for run/enrich actions: admins always allowed; users need
// can_run_searches. Throws if not permitted.
export async function requireRunner(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin" && !profile.can_run_searches) {
    throw new Error("You don't have permission to run searches.");
  }
  return profile;
}
